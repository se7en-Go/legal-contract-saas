import { callLlm, getServiceClient } from "../_shared/llmClient.ts";

type ExtractPayload = {
  tenant_id: string;
  contract_version_id: string;
  categories?: string[];
};

const supabase = getServiceClient();

function assertAuthorized(req: Request) {
  const expected = Deno.env.get("KEY_CLAUSE_EXTRACTOR_TOKEN");
  if (!expected) throw new Error("KEY_CLAUSE_EXTRACTOR_TOKEN missing");
  const token = req.headers.get("authorization")?.replace("Bearer", "").trim();
  if (!token || token !== expected) {
    throw new Error("Unauthorized");
  }
}

async function fetchClauses(contractVersionId: string) {
  const { data, error } = await supabase
    .from("clauses")
    .select("id, clause_no, title, body")
    .eq("contract_version_id", contractVersionId)
    .order("clause_no", { ascending: true });

  if (error) throw new Error(`Failed to load clauses: ${error.message}`);
  return data ?? [];
}

async function insertKeyClauses(contractVersionId: string, rows: { category: string; summary: string; attributes?: Record<string, unknown> }[]) {
  if (!rows.length) return;
  const payload = rows.map((row) => ({
    contract_version_id: contractVersionId,
    category: row.category,
    summary: row.summary,
    attributes: row.attributes ?? {},
  }));

  const { error } = await supabase.from("key_clauses").insert(payload);
  if (error) throw new Error(`Failed to insert key clauses: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    assertAuthorized(req);
    const payload = (await req.json()) as ExtractPayload;
    if (!payload.contract_version_id || !payload.tenant_id) {
      return new Response("tenant_id and contract_version_id required", { status: 400 });
    }

    const clauses = await fetchClauses(payload.contract_version_id);
    if (!clauses.length) {
      return new Response(JSON.stringify({ message: "no-clauses" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    const llmResponse = await callLlm({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是一名法律专家，请将合同条款归档为少量关键条款，输出 JSON: {\"clauses\":[{\"category\":\"付款条款\",\"summary\":\"...\",\"attributes\":{\"sla\":\"99.5%\"}}]}。",
        },
        { role: "user", content: JSON.stringify({ clauses, focus: payload.categories ?? [] }) },
      ],
    });

    const json = llmResponse?.choices?.[0]?.message?.content;
    const parsed = json ? JSON.parse(json) : { clauses: [] };
    await insertKeyClauses(payload.contract_version_id, parsed.clauses ?? []);

    await supabase.from("notifications").insert({
      tenant_id: payload.tenant_id,
      entity: `contract_version:${payload.contract_version_id}`,
      severity: "info",
      message: `关键条款已提取 (${parsed.clauses?.length ?? 0})`,
      metadata: { categories: payload.categories ?? [] },
    });

    return new Response(JSON.stringify({ inserted: parsed.clauses?.length ?? 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
