import { callLlm, getServiceClient } from "../_shared/llmClient.ts";

type ExtractPayload = {
  tenant_id: string;
  contract_version_id: string;
  categories?: string[];
};

type ClauseRecord = {
  id: string;
  clause_no: string | null;
  title: string | null;
  body: string | null;
};

type ExtractedClause = {
  category: string;
  summary: string;
  attributes?: Record<string, unknown>;
  clause_id?: string;
  clause_no?: string;
};

type ClauseIndex = {
  byId: Map<string, ClauseRecord>;
  byNumber: Map<string, ClauseRecord>;
};

const supabase = getServiceClient();

function assertAuthorized(req: Request) {
  const expected = Deno.env.get("KEY_CLAUSE_EXTRACTOR_TOKEN");
  if (!expected) throw new Error("KEY_CLAUSE_EXTRACTOR_TOKEN missing");
  const token = req.headers.get("x-agent-token") ??
    req.headers.get("authorization")?.replace(/^(?:Bearer\s+)/i, "").trim();
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
  return (data ?? []) as ClauseRecord[];
}

function buildClauseIndex(clauses: ClauseRecord[]): ClauseIndex {
  const byId = new Map<string, ClauseRecord>();
  const byNumber = new Map<string, ClauseRecord>();
  clauses.forEach((clause) => {
    byId.set(clause.id, clause);
    if (clause.clause_no) {
      byNumber.set(clause.clause_no, clause);
    }
  });
  return { byId, byNumber };
}

function resolveClauseId(row: ExtractedClause, index: ClauseIndex): string | null {
  if (row.clause_id && index.byId.has(row.clause_id)) {
    return row.clause_id;
  }
  if (row.clause_no) {
    const match = index.byNumber.get(row.clause_no);
    if (match) return match.id;
  }
  return null;
}

async function insertKeyClauses(
  contractVersionId: string,
  rows: ExtractedClause[],
  clauseIndex: ClauseIndex,
) {
  if (!rows.length) return;
  const payload = rows.map((row) => ({
    contract_version_id: contractVersionId,
    clause_id: resolveClauseId(row, clauseIndex),
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
      return new Response(JSON.stringify({ message: "no-clauses" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const clauseIndex = buildClauseIndex(clauses);
    const clauseSummaries = clauses.map((clause) => ({
      id: clause.id,
      number: clause.clause_no ?? "",
      title: clause.title ?? "",
      text: clause.body ?? "",
    }));

    const systemPrompt =
      "你是一名法律专家，请从输入条款中挑选若干关键条款。" +
      "输出 JSON 结构 {\"clauses\":[{\"category\":\"...\",\"summary\":\"...\",\"clause_id\":\"<输入提供的 id>\",\"attributes\":{}}]}" +
      "，clause_id 必须引用输入数组中的 id，可选提供 clause_no 作为备份。";

    const llmResponse = await callLlm({
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: JSON.stringify({
            clauses: clauseSummaries,
            focus: payload.categories ?? [],
          }),
        },
      ],
    });

    const raw = llmResponse?.choices?.[0]?.message?.content || "";
    const sanitized = raw.replace(/```json|```/gi, "").trim();
    const parsed = sanitized ? JSON.parse(sanitized) : { clauses: [] };
    const extracted = Array.isArray(parsed?.clauses) ? parsed.clauses as ExtractedClause[] : [];
    await insertKeyClauses(payload.contract_version_id, extracted, clauseIndex);

    await supabase.from("notifications").insert({
      tenant_id: payload.tenant_id,
      entity: `contract_version:${payload.contract_version_id}`,
      severity: "info",
      message: `关键条款已提取(${extracted.length})`,
      metadata: { categories: payload.categories ?? [] },
    });

    return new Response(JSON.stringify({ inserted: extracted.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
