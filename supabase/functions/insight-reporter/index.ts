import { callLlm } from "../_shared/llmClient.ts";

type ReporterPayload = {
  tenant_id: string;
  data: {
    contracts: number;
    risks: number;
    highRisks: number;
    openTasks: number;
    highlights: { title: string; detail: string }[];
  };
};

function assertAuthorized(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer", "").trim();
  const expected = Deno.env.get("INSIGHT_REPORTER_TOKEN");
  if (!expected) throw new Error("INSIGHT_REPORTER_TOKEN missing");
  if (!token || token !== expected) throw new Error("Unauthorized");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    assertAuthorized(req);
    const payload = (await req.json()) as ReporterPayload;
    if (!payload.tenant_id) {
      return new Response("tenant_id required", { status: 400 });
    }

    const prompt = `请根据以下数据生成一份简洁的合同风险周报，包含概览、重点风险和建议。使用 Markdown 输出。
数据：
合同总数：${payload.data.contracts}
风险总数：${payload.data.risks}
高风险：${payload.data.highRisks}
未完成任务：${payload.data.openTasks}
Highlights: ${JSON.stringify(payload.data.highlights)}
`;

    const llmResponse = await callLlm({
      messages: [
        { role: "system", content: "你是法律合规顾问，请输出 Markdown 报告。" },
        { role: "user", content: prompt },
      ],
    });

    const markdown = llmResponse?.choices?.[0]?.message?.content ?? "No content";
    return new Response(JSON.stringify({ markdown }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
