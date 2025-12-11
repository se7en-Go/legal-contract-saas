import JSZip from "npm:jszip";
import { callLlm, getServiceClient } from "../_shared/llmClient.ts";

type TaskRecord = {
  id: string;
  tenant_id: string;
  task_type: string;
  payload: Record<string, unknown>;
  retry_count?: number;
  priority?: number;
  worker_id?: string;
  started_at?: string;
  timeout_at?: string;
};

type Clause = {
  number?: string;
  title?: string;
  text: string;
};

type TaskMetrics = {
  worker_id: string;
  task_type: string;
  status: string;
  duration_seconds?: number;
  error_message?: string;
};

const supabase = getServiceClient();
const MAX_ATTEMPTS = Number(Deno.env.get("TASK_MAX_ATTEMPTS") ?? 3);
const CONTRACTS_BUCKET = Deno.env.get("CONTRACTS_BUCKET") ?? "contracts";
const BATCH_SIZE = Number(Deno.env.get("TASK_BATCH_SIZE") ?? 3);
const TASK_TIMEOUT = Number(Deno.env.get("TASK_TIMEOUT_MINUTES") ?? 10);

// 生成唯一的工作节点ID
const WORKER_ID = `worker-${crypto.randomUUID()}-${Date.now()}`;

function assertAuthorized(req: Request) {
  const envToken = Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
  if (!envToken) throw new Error("PROJECT_SERVICE_ROLE_KEY missing");
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
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

function chunkBase64(input: string, chunkSize = 6000) {
  const chunks = [];
  for (let i = 0; i < input.length; i += chunkSize) {
    chunks.push(input.slice(i, i + chunkSize));
  }
  return chunks;
}

async function extractDocxText(fileBytes: Uint8Array) {
  const zip = await JSZip.loadAsync(fileBytes);
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("DOCX 缺少 word/document.xml");
  }
  const xml = await document.async("string");
  return xml
    .replace(/<w:p[^>]*>/g, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractText(contractTitle: string, sourcePath: string, fileBytes: Uint8Array) {
  const lower = sourcePath.toLowerCase();
  if (lower.endsWith(".docx")) {
    return await extractDocxText(fileBytes);
  }
  return await performOcr(contractTitle, fileBytes);
}

// 批量获取任务 - 直接查询不使用RPC函数（临时修复）
async function fetchQueuedTasks(taskType?: string, batchSize = BATCH_SIZE): Promise<TaskRecord[]> {
  const query = supabase
    .from("tasks")
    .select("id, tenant_id, task_type, payload, retry_count, priority")
    .eq("status", "queued")
    .order("priority DESC", "created_at ASC")
    .limit(batchSize);

  if (taskType) {
    query.eq("task_type", taskType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to fetch tasks:', error);
    throw new Error(`Failed to fetch tasks: ${error.message}`);
  }

  return (data || []) as TaskRecord[];
}

// 释放任务锁
async function releaseTask(taskId: string, status: string, error?: string) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
    worker_id: null,
    started_at: null,
    timeout_at: null
  };

  if (error) {
    updateData.last_error = error;
  }

  const { error: updateError } = await supabase
    .from("tasks")
    .update(updateData)
    .eq("id", taskId);

  if (updateError) {
    throw new Error(`Failed to release task: ${updateError.message}`);
  }
}

// 记录任务指标
async function recordTaskMetrics(metrics: TaskMetrics) {
  // 检查必需字段
  if (!metrics.task_type) {
    console.error("Missing task_type in metrics, skipping record");
    return;
  }

  const { error } = await supabase
    .from("task_metrics")
    .insert({
      worker_id: metrics.worker_id,
      task_type: metrics.task_type,
      status: metrics.status,
      duration_seconds: metrics.duration_seconds,
      error_message: metrics.error_message
    });

  if (error) {
    console.error("Failed to record task metrics:", error);
  }
}

// 重试失败任务
async function retryFailedTasks(taskType?: string) {
  const { data, error } = await supabase
    .rpc('retry_failed_tasks', {
      p_task_type: taskType || null,
      p_max_retry_count: MAX_ATTEMPTS
    });

  if (error) {
    console.error("Failed to retry tasks:", error);
  } else {
    console.log(`Retried ${data || 0} failed tasks`);
  }
}

// 检查任务超时
async function checkTaskTimeouts() {
  const { data, error } = await supabase
    .rpc('check_task_timeouts');

  if (error) {
    console.error("Failed to check timeouts:", error);
  } else if (data && data > 0) {
    console.log(`Found ${data} timed out tasks`);
  }
}

// 清理旧任务
async function cleanupOldTasks() {
  const { data, error } = await supabase
    .rpc('cleanup_old_tasks');

  if (error) {
    console.error("Failed to cleanup old tasks:", error);
  } else {
    console.log(`Cleaned up ${data || 0} old tasks`);
  }
}

async function recordTaskAttempt(taskId: string, attemptNo: number, status: string, message?: string) {
  const { error } = await supabase.from("task_attempts").insert({
    task_id: taskId,
    attempt_no: attemptNo,
    status,
    message: message ?? null,
  });
  if (error) console.error("Failed to record attempt:", error);
}

async function createNotification(tenantId: string, entity: string, message: string, severity: string, metadata: Record<string, unknown>) {
  const { error } = await supabase.from("notifications").insert({
    tenant_id: tenantId,
    entity,
    message,
    severity,
    metadata,
  });
  if (error) console.error("Failed to create notification:", error);
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

  const base64Text = bytesToBase64(fileBytes);
  const chunks = chunkBase64(base64Text, 6000);
  const segments: string[] = [];
  const url = `${baseUrl.replace(/\/$/, "")}/v1/chat/completions`;

  for (let i = 0; i < chunks.length; i++) {
    const payload = {
      model,
      temperature: 0,
      messages: [
        { role: "system", content: "你是一位OCR专家，请将不同合同识别为规范的中文段落文本。" },
        {
          role: "user",
          content: `合同标题：${contractTitle}\n第 ${i + 1}/${chunks.length} 部分 Base64 编码如下，请识别并转换为规范的段落文本：\n${chunks[i]}`,
        },
      ],
    };

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
    if (!content) throw new Error(`OCR 未返回内容 (chunk ${i + 1})`);
    segments.push(content as string);
  }

  return segments.join("\n---\n");
}

async function parseContractClauses(contractTitle: string, rawText: string) {
  const promptLines = [
    '你是一位法律合同审查专家，需要根据输入文本把合同拆成条款段落，并标注编号、标题、正文。',
    '合同标题:' + contractTitle,
    '合同内容:',
    rawText,
    '',
    '请输出 JSON 格式 { "clauses": [{"number": "1", "title": "", "text": ""}, ...] }，只返回 JSON，不要包含其它字符或解释。',
  ];
  const prompt = promptLines.join("\n");

  const response = await callLlm({
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: '你是一位合同审查专家' },
      { role: "user", content: prompt },
    ],
  });

  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 未返回内容');
  const sanitized = content.replace(/```json|```/g, '').trim();
  const json = sanitized ? JSON.parse(sanitized) : { clauses: [] };
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
  const serviceToken = Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
  if (!baseUrl || !serviceToken) {
    throw new Error("Missing PROJECT_SUPABASE_URL or PROJECT_SERVICE_ROLE_KEY");
  }

  const response = await fetch(`${baseUrl}/functions/v1/risk-analyzer`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
      apikey: serviceToken,
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
  const agentToken = Deno.env.get("KEY_CLAUSE_EXTRACTOR_TOKEN");
  const serviceToken = Deno.env.get("PROJECT_SERVICE_ROLE_KEY");
  if (!baseUrl || !agentToken || !serviceToken) {
    console.warn("Key clause extractor not configured");
    return;
  }
  await fetch(`${baseUrl}/functions/v1/key-clause-extractor`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
      apikey: serviceToken,
      "x-agent-token": agentToken,
    },
    body: JSON.stringify({ tenant_id: tenantId, contract_version_id: contractVersionId }),
  }).catch((error) => console.error("key-clause-extractor failed:", error));
}

// 处理单个任务
async function processTask(task: TaskRecord): Promise<{ success: boolean; error?: string; clausesCreated?: number }> {
  const startTime = Date.now();

  try {
    // 确保task记录有id
    if (!task.id) {
      throw new Error("Task record missing id");
    }

    const contractVersionId = task.payload?.contract_version_id as string | undefined;
    if (!contractVersionId) {
      throw new Error("missing contract_version_id");
    }

    const version = await fetchContractVersion(contractVersionId);
    const contract = await fetchContract(version.contract_id);
    const fileBytes = await downloadContractBytes(version.source_path);
    const rawText = await extractText(contract.title, version.source_path, fileBytes);

    const clauses = await parseContractClauses(contract.title, rawText);
    await insertClauses(contractVersionId, clauses);
    await runRiskAnalysis(task.tenant_id, contractVersionId);
    await triggerKeyClauseExtraction(task.tenant_id, contractVersionId);

    // 更新任务状态为完成
    await supabase.from("tasks").update({
      status: "completed",
      updated_at: new Date().toISOString(),
      worker_id: null,
      started_at: null,
      timeout_at: null
    }).eq("id", task.id);

    await recordTaskAttempt(task.id, (task.retry_count ?? 0) + 1, "completed");
    await createNotification(
      task.tenant_id,
      `task:${task.id}`,
      `任务 ${task.task_type} 已完成`,
      "success",
      { clauses_created: clauses.length }
    );

    // 记录成功指标
    const duration = (Date.now() - startTime) / 1000;
    await recordTaskMetrics({
      worker_id: WORKER_ID,
      task_type: task.task_type,
      status: "completed",
      duration_seconds: duration
    });

    return { success: true, clausesCreated: clauses.length };
  } catch (error) {
    const message = (error as Error).message;
    const duration = (Date.now() - startTime) / 1000;

    // 记录错误指标
    await recordTaskMetrics({
      worker_id: WORKER_ID,
      task_type: task.task_type,
      status: "failed",
      duration_seconds: duration,
      error_message: message
    });

    try {
      const nextRetry = (task.retry_count ?? 0) + 1;
      await recordTaskAttempt(task.id, nextRetry, "failed", message);
      const shouldRetry = nextRetry < MAX_ATTEMPTS;

      await supabase.from("tasks").update({
        status: shouldRetry ? "queued" : "failed",
        retry_count: nextRetry,
        last_error: message,
        updated_at: new Date().toISOString(),
        worker_id: null,
        started_at: null,
        timeout_at: null
      }).eq("id", task.id);

      if (!shouldRetry) {
        await supabase.from("approvals").insert({
          tenant_id: task.tenant_id,
          entity_type: "task",
          entity_id: task.id,
          status: "pending",
          note: message,
        });
        await createNotification(
          task.tenant_id,
          `task:${task.id}`,
          `任务 ${task.task_type} 已失败`,
          "error",
          { last_error: message }
        );
      }

      return { success: false, error: message };
    } catch (inner) {
      console.error("Failed to record retry info:", inner);
      return { success: false, error: `${message}; Failed to record retry: ${inner.message}` };
    }
  }
}

// 批量处理任务
async function processBatchTasks(taskType?: string): Promise<{ processed: number; results: any[] }> {
  const tasks = await fetchQueuedTasks(taskType);
  if (tasks.length === 0) {
    return { processed: 0, results: [] };
  }

  console.log(`Worker ${WORKER_ID} processing ${tasks.length} tasks`);

  const results = [];
  for (const task of tasks) {
    const result = await processTask(task);
    results.push({ taskId: task.id, ...result });
  }

  return { processed: tasks.length, results };
}

Deno.serve(async (req) => {
  try {
    assertAuthorized(req);

    const url = new URL(req.url);
    const taskType = url.searchParams.get("task_type") || undefined;
    const action = url.searchParams.get("action") || "process";

    let responseData: any;

    switch (action) {
      case "health":
        // 健康检查
        responseData = {
          status: "healthy",
          worker_id: WORKER_ID,
          timestamp: new Date().toISOString()
        };
        break;

      case "maintenance":
        // 维护任务：清理和重试
        await checkTaskTimeouts();
        await retryFailedTasks(taskType);
        await cleanupOldTasks();
        responseData = {
          status: "maintenance_completed",
          worker_id: WORKER_ID
        };
        break;

      case "process":
      default:
        // 处理任务
        const { processed, results } = await processBatchTasks(taskType);

        responseData = {
          worker_id: WORKER_ID,
          tasks_processed: processed,
          results,
          timestamp: new Date().toISOString()
        };

        if (processed === 0) {
          return new Response(
            JSON.stringify({ message: "no-tasks", ...responseData }),
            { status: 200 }
          );
        }
        break;
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Task runner error:", error);
    const message = (error as Error).message;

    return new Response(
      JSON.stringify({
        error: message,
        worker_id: WORKER_ID,
        timestamp: new Date().toISOString()
      }),
      { status: 500 }
    );
  }
});