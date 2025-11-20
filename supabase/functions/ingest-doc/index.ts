import { getServiceClient } from "../_shared/llmClient.ts";

type IngestPayload = {
  tenant_id: string;
  title: string;
  counterparty?: string;
  storage_path: string;
  checksum?: string;
  metadata?: Record<string, unknown>;
  parsed_json?: Record<string, unknown>;
  summary?: string;
};

const supabase = getServiceClient();

async function ensureContract(payload: IngestPayload) {
  const { data, error } = await supabase
    .from("contracts")
    .insert({
      tenant_id: payload.tenant_id,
      title: payload.title,
      counterparty: payload.counterparty ?? null,
      storage_path: payload.storage_path,
      checksum: payload.checksum ?? null,
      metadata: payload.metadata ?? {},
    })
    .select("id, tenant_id")
    .single();

  if (error) {
    throw new Error(`Failed to create contract: ${error.message}`);
  }

  return data;
}

async function createContractVersion(contractId: string, payload: IngestPayload) {
  const { data, error } = await supabase
    .from("contract_versions")
    .insert({
      contract_id: contractId,
      version_no: 1,
      source_path: payload.storage_path,
      parsed_json: payload.parsed_json ?? null,
      summary: payload.summary ?? null,
    })
    .select("id, contract_id")
    .single();

  if (error) {
    throw new Error(`Failed to create contract version: ${error.message}`);
  }

  return data;
}

async function enqueueTask(tenantId: string, versionId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      tenant_id: tenantId,
      task_type: "ingestion",
      payload: { contract_version_id: versionId },
    })
    .select("id, status")
    .single();

  if (error) {
    throw new Error(`Failed to create task: ${error.message}`);
  }

  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = (await req.json()) as IngestPayload;
    if (!payload.tenant_id || !payload.title || !payload.storage_path) {
      return new Response("tenant_id, title, storage_path are required", { status: 400 });
    }

    const contract = await ensureContract(payload);
    const version = await createContractVersion(contract.id, payload);
    const task = await enqueueTask(contract.tenant_id, version.id);

    return new Response(
      JSON.stringify({
        contract_id: contract.id,
        contract_version_id: version.id,
        task_id: task.id,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
