import { callLlm, getServiceClient } from "../_shared/llmClient.ts";

type TaskRecord = {
  id: string;
  tenant_id: string;
  task_type: string;
  payload: Record<string, unknown>;
  retry_count?: number;
};

type Clause = {
  number?: string;
  title?: string;
  text: string;
};

const supabase = getServiceClient();
const MAX_ATTEMPTS = Number(Deno.env.get("TASK_MAX_ATTEMPTS") ?? 3);
const CONTRACTS_BUCKET = Deno.env.get("CONTRACTS_BUCKET") ?? "contracts";

function assertAuthorized(req: Request) {
  const authHeader = req.headers.get("authorization") ?? "";
  const envToken = Deno.env.get("TASK_RUNNER_SERVICE_TOKEN");
  if (!envToken) throw new Error("TASK_RUNNER_SERVICE_TOKEN missing");
  const token = authHeader.replace("Bearer", "").trim();
  if (!token || token !== envToken) {
    throw new Error("Unauthorized");
  }
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const sub = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
}

async function fetchQueuedTask() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, tenant_id, task_type, payload, retry_count")
    .eq("task_type", "ingestion")
    .eq("status", "queued")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load task: ${error.message}`);
  return data as TaskRecord | null;
}

async function markTask(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from("tasks").update(fields).eq("id", id);
  if (error) throw new Error(`Failed to update task: ${error.message}`);
}

async function recordTaskAttempt(taskId: string, attemptNo: number, status: string, message?: string) {
  const { error } = await supabase.from("task_attempts").insert({
    task_id: taskId,
    attempt_no: attemptNo,
    status,
    message: message ?? null,
  });
  if (error) throw new Error(`Failed to record attempt: ${error.message}`);
}

async function createNotification(tenantId: string, entity: string, message: string, severity: string, metadata: Record<string, unknown>) {
  const { error } = await supabase.from("notifications").insert({
    tenant_id: tenantId,
    entity,
    message,
    severity,
    metadata,
  });
  if (error) console.error("Failed to create notification", error);
}

async function fetchContractVersion(contractVersionId: string) {
  const { data, error } = await supabase
    .from("contract_versions")
    .select("id, contract_id, source_path")
    .eq("id", contractVersionId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch contract version: ${error.message}`);
  if (!data) throw new Error("Contract version not found");
  return data;
}

async function fetchContract(contractId: string) {
  const { data, error } = await supabase
    .from("contracts")
    .select("id, title, metadata")
    .eq("id", contractId)
    .maybeSingle();
  if (error) throw new Error(`Failed to fetch contract: ${error.message}`);
  if (!data) throw new Error("Contract not found");
  return data;
}

async function downloadContractBytes(path: string) {
  const { data, error } = await supabase.storage.from(CONTRACTS_BUCKET).download(path);
  if (error || !data) throw new Error(`Failed to download contract: ${error?.message ?? "unknown"}`);
  const buffer = await data.arrayBuffer();
  return new Uint8Array(buffer);
}

async function performOcr(contractTitle: string, fileBytes: Uint8Array) {
  const baseUrl = Deno.env.get("OCR_BASE_URL");
  const apiKey = Deno.env.get("OCR_API_KEY");
  const model = Deno.env.get("OCR_MODEL_ID");
  if (!baseUrl || !apiKey || !model) {
    throw new Error("Missing OCR configuration");
  }

  const payload = {
    model,
    temperature: 0,
    messages: [
      { role: "system", content: "你是OCR专家，请将合同内容识别为可阅读的中文文本。" },
      {
        role: "user",
        content:
          `合同标题：${contractTitle}\n以下是合同文件的Base64编码，请解码成可阅读的文本：\n${bytesToBase64(fileBytes)}`,
      },
    ],
  };

  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OCR request failed: ${response.status} ${text}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OCR 未返回内容");
  return content as string;
}

async function parseContractClauses(contractTitle: string, rawText: string) {
  const prompt = `你是一位法律合同整理专家，请根据以下文本，将合同拆解为条款列表，包含条款编号、标题、正文。\n合同标题：${contractTitle}\n合同正文：\n${rawText}\n\n输出 JSON，格式 { \"clauses\": [{\"number\": \"1\", \"title\": \"\", \"text\": \"\"}, ...] }。`;

  const response = await callLlm({
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: "你是法律合同拆解专家。" },
      { role: "user", content: prompt },
    ],
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM 未返回内容");
  const json = JSON.parse(content);
  return (json.clauses as Clause[]) ?? [];
}

async function insertClauses(contractVersionId: string, clauses: Clause[]) {
  if (!clauses.length) return;
  const rows = clauses.map((clause) => ({
    contract_version_id: contractVersionId,
    clause_no: clause.number ?? null,
    title: clause.title ?? null,
    body: clause.text,
  }));

  const { error } = await supabase.from("clauses").insert(rows);
  if (error) throw new Error(`Failed to insert clauses: ${error.message}`);
}

async function runRiskAnalysis(tenantId: string, contractVersionId: string) {
  const baseUrl = Deno.env.get("PROJECT_SUPABASE_URL");
  const serviceToken = Deno.env.get("TASK_RUNNER_SERVICE_TOKEN");
  if (!baseUrl || !serviceToken) {
    throw new Error("Missing PROJECT_SUPABASE_URL or TASK_RUNNER_SERVICE_TOKEN");
  }

  const response = await fetch(`${baseUrl}/functions/v1/risk-analyzer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({ tenant_id: tenantId, contract_version_id: contractVersionId }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`risk-analyzer failed: ${response.status} ${text}`);
  }

  return await response.json();
}

async function triggerKeyClauseExtraction(tenantId: string, contractVersionId: string) {
  const baseUrl = Deno.env.get("PROJECT_SUPABASE_URL");
  const token = Deno.env.get("KEY_CLAUSE_EXTRACTOR_TOKEN");
  if (!baseUrl || !token) {
    console.warn("Key clause extractor not configured");
    return;
  }
  await fetch(`${baseUrl}/functions/v1/key-clause-extractor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tenant_id: tenantId, contract_version_id: contractVersionId }),
  }).catch((error) => console.error("key-clause-extractor failed", error));
}

Deno.serve(async (req) => {
  let currentTask: TaskRecord | null = null;
  try {
    assertAuthorized(req);

    const task = await fetchQueuedTask();
    if (!task) {
      return new Response(JSON.stringify({ message: "no-task" }), { status: 200 });
    }
    currentTask = task;

    await markTask(task.id, { status: "processing", updated_at: new Date().toISOString() });

    const contractVersionId = task.payload?.contract_version_id as string | undefined;
    if (!contractVersionId) {
      await markTask(task.id, { status: "failed", error: "missing contract_version_id" });
      return new Response(JSON.stringify({ error: "missing contract_version_id" }), { status: 400 });
    }

    const version = await fetchContractVersion(contractVersionId);
    const contract = await fetchContract(version.contract_id);
    const fileBytes = await downloadContractBytes(version.source_path);
    const rawText = await performOcr(contract.title, fileBytes);

    const clauses = await parseContractClauses(contract.title, rawText);
    await insertClauses(contractVersionId, clauses);
    await runRiskAnalysis(task.tenant_id, contractVersionId);
    await triggerKeyClauseExtraction(task.tenant_id, contractVersionId);
    await markTask(task.id, { status: "completed", updated_at: new Date().toISOString(), retry_count: task.retry_count ?? 0, last_error: null });
    await recordTaskAttempt(task.id, (task.retry_count ?? 0) + 1, "completed");
    await createNotification(task.tenant_id, `task:${task.id}`, `任务 ${task.task_type} 已完成`, "success", { clauses_created: clauses.length });

    return new Response(JSON.stringify({ task_id: task.id, clauses_created: clauses.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    const message = (error as Error).message;
    try {
      if (currentTask) {
        const nextRetry = (currentTask.retry_count ?? 0) + 1;
        await recordTaskAttempt(currentTask.id, nextRetry, "failed", message);
        const shouldRetry = nextRetry < MAX_ATTEMPTS;
        await markTask(currentTask.id, {
          status: shouldRetry ? "queued" : "failed",
          retry_count: nextRetry,
          last_error: message,
          updated_at: new Date().toISOString(),
        });
        if (!shouldRetry) {
          await supabase.from("approvals").insert({
            tenant_id: currentTask.tenant_id,
            entity_type: "task",
            entity_id: currentTask.id,
            status: "pending",
            note: message,
          });
          await createNotification(currentTask.tenant_id, `task:${currentTask.id}`, `任务 ${currentTask.task_type} 多次失败`, "error", { last_error: message });
        }
      }
    } catch (inner) {
      console.error("Failed to record retry info", inner);
    }
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
