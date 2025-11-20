import { callLlm, getServiceClient } from "../_shared/llmClient.ts";

type TaskRecord = {
  id: string;
  tenant_id: string;
  task_type: string;
  payload: Record<string, unknown>;
};

type Clause = {
  number?: string;
  title?: string;
  text: string;
};

const supabase = getServiceClient();

async function fetchQueuedTask() {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, tenant_id, task_type, payload")
    .eq("task_type", "ingestion")
    .eq("status", "queued")
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to load task: ${error.message}`);
  return (data as TaskRecord) ?? null;
}

async function markTask(id: string, fields: Record<string, unknown>) {
  const { error } = await supabase.from("tasks").update(fields).eq("id", id);
  if (error) throw new Error(`Failed to update task: ${error.message}`);
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

async function parseContractClauses(contractTitle: string, contractPath: string) {
  const prompt = `你是一位法律合同整理专家，请根据以下信息，将合同拆解为条款列表，包含条款编号、标题、正文。\n如果合同正文在 object storage 路径 ${contractPath}，请结合合同标题 ${contractTitle} 进行解析。\n输出 JSON，格式 { "clauses": [{"number": "1", "title": "", "text": ""}, ...] }。`;

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

Deno.serve(async () => {
  try {
    const task = await fetchQueuedTask();
    if (!task) {
      return new Response(JSON.stringify({ message: "no-task" }), { status: 200 });
    }

    await markTask(task.id, { status: "processing", updated_at: new Date().toISOString() });

    const contractVersionId = task.payload?.contract_version_id as string | undefined;
    if (!contractVersionId) {
      await markTask(task.id, { status: "failed", error: "missing contract_version_id" });
      return new Response(JSON.stringify({ error: "missing contract_version_id" }), { status: 400 });
    }

    const version = await fetchContractVersion(contractVersionId);
    const contract = await fetchContract(version.contract_id);

    const clauses = await parseContractClauses(contract.title, version.source_path);
    await insertClauses(contractVersionId, clauses);
    await runRiskAnalysis(task.tenant_id, contractVersionId);
    await markTask(task.id, { status: "completed", updated_at: new Date().toISOString() });

    return new Response(JSON.stringify({ task_id: task.id, clauses_created: clauses.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
