import { callLlm, getServiceClient } from "../_shared/llmClient.ts";

type AnalyzePayload = {
  tenant_id: string;
  contract_version_id: string;
};

const supabase = getServiceClient();

async function fetchClauses(contractVersionId: string) {
  const { data, error } = await supabase
    .from("clauses")
    .select("id, clause_no, title, body")
    .eq("contract_version_id", contractVersionId)
    .order("clause_no", { ascending: true });

  if (error) {
    throw new Error(`Failed to load clauses: ${error.message}`);
  }

  return data ?? [];
}

async function storeFindings(clauseMap: Record<string, string>, findings: any[]) {
  if (!findings?.length) return [];
  const rows = findings
    .map((finding) => {
      const clauseId = clauseMap[finding.clause_no];
      if (!clauseId) return null;
      return {
        clause_id: clauseId,
        risk_level: finding.risk_level ?? "medium",
        risk_type: finding.risk_type ?? null,
        description: finding.description ?? null,
        recommendation: finding.recommendation ?? null,
        regulation_refs: finding.regulation_refs ?? null,
      };
    })
    .filter(Boolean);

  if (!rows.length) return [];

  const { data, error } = await supabase.from("risk_findings").insert(rows).select("id, clause_id");
  if (error) {
    throw new Error(`Failed to store findings: ${error.message}`);
  }

  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const payload = (await req.json()) as AnalyzePayload;
    if (!payload.contract_version_id || !payload.tenant_id) {
      return new Response("contract_version_id and tenant_id required", { status: 400 });
    }

    const clauses = await fetchClauses(payload.contract_version_id);
    if (!clauses.length) {
      return new Response(JSON.stringify({ message: "No clauses found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const clauseMap: Record<string, string> = {};
    const clauseSummaries = clauses.map((clause) => {
      clauseMap[clause.clause_no ?? clause.id] = clause.id;
      return {
        number: clause.clause_no ?? "",
        title: clause.title ?? "",
        text: clause.body,
      };
    });

    const llmResponse = await callLlm({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "你是一名法律合同审查专家，需要识别风险条款、风险等级、原因、修改建议以及相关法规。输出 JSON，形如 {\"findings\":[{\"clause_no\":...,\"risk_level\":...,\"description\":...,\"recommendation\":...,\"regulation_refs\":[]}]}",
        },
        {
          role: "user",
          content: JSON.stringify({ clauses: clauseSummaries }),
        },
      ],
    });

    const content = llmResponse?.choices?.[0]?.message?.content;
    const parsed = content ? JSON.parse(content) : {};
    const inserted = await storeFindings(clauseMap, parsed.findings ?? []);

    return new Response(
      JSON.stringify({ inserted: inserted.length }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
