import { getServiceClient } from "../_shared/llmClient.ts";

type RegulationFeed = {
  name: string;
  jurisdiction: string;
  effective_date?: string;
  expiry_date?: string | null;
  source_url?: string;
  sections: {
    section_no: string;
    text: string;
    tags?: string[];
  }[];
};

const supabase = getServiceClient();

function assertAuthorized(req: Request) {
  const expected = Deno.env.get("REGULATION_SYNC_TOKEN");
  if (!expected) throw new Error("REGULATION_SYNC_TOKEN missing");
  const token = req.headers.get("authorization")?.replace("Bearer", "").trim();
  if (!token || token !== expected) {
    throw new Error("Unauthorized");
  }
}

async function fetchFeedFromUrl(url: string): Promise<RegulationFeed[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch regulation feed: ${response.status} ${await response.text()}`);
  }
  return await response.json();
}

async function upsertRegulation(tenantId: string, feed: RegulationFeed) {
  const { data, error } = await supabase
    .from("regulations")
    .upsert(
      {
        name: feed.name,
        jurisdiction: feed.jurisdiction,
        effective_date: feed.effective_date ?? null,
        expiry_date: feed.expiry_date ?? null,
        source_url: feed.source_url ?? null,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to upsert regulation ${feed.name}: ${error.message}`);
  }

  const regulationId = data.id;
  const sectionRows = feed.sections.map((section) => ({
    regulation_id: regulationId,
    section_no: section.section_no,
    text: section.text,
    tags: section.tags ?? [],
  }));

  const { error: sectionError } = await supabase.from("regulation_sections").upsert(sectionRows, {
    onConflict: "regulation_id, section_no",
  });
  if (sectionError) {
    throw new Error(`Failed to upsert sections for ${feed.name}: ${sectionError.message}`);
  }

  await supabase
    .from("notifications")
    .insert({
      tenant_id: tenantId,
      entity: `regulation:${regulationId}`,
      message: `${feed.name} 已同步 ${feed.sections.length} 个章节`,
      severity: "info",
      metadata: { jurisdiction: feed.jurisdiction },
    });
}

const fallbackFeed: RegulationFeed[] = [
  {
    name: "数据跨境安全管理规范",
    jurisdiction: "CN",
    effective_date: "2024-01-01",
    source_url: "https://example.com/regulations/cn/data-cross-border",
    sections: [
      { section_no: "第 8 条", text: "个人信息出境需通过安全评估，合同需明确双方责任。", tags: ["security", "contract"] },
      { section_no: "第 15 条", text: "关键信息基础设施运营者需要明确技术与管理要求。", tags: ["critical"] },
    ],
  },
];

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    assertAuthorized(req);
    const body = (await req.json().catch(() => ({}))) as { feed_url?: string; tenant_id?: string; feed?: RegulationFeed[] };
    const tenantId = body.tenant_id ?? Deno.env.get("DEFAULT_TENANT_ID");
    if (!tenantId) {
      return new Response("tenant_id is required", { status: 400 });
    }

    let feeds: RegulationFeed[] = [];
    if (body.feed?.length) {
      feeds = body.feed;
    } else if (body.feed_url ?? Deno.env.get("REGULATION_FEED_URL")) {
      feeds = await fetchFeedFromUrl(body.feed_url ?? Deno.env.get("REGULATION_FEED_URL")!);
    } else {
      feeds = fallbackFeed;
    }

    for (const feed of feeds) {
      await upsertRegulation(tenantId, feed);
    }

    return new Response(JSON.stringify({ synced: feeds.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
