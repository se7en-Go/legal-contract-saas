import { getServiceClient } from "../_shared/llmClient.ts";

const supabase = getServiceClient();
const BATCH_SIZE = Number(Deno.env.get("NOTIFICATION_BATCH_LIMIT") ?? 20);

function assertAuthorized(req: Request) {
  const expected = Deno.env.get("NOTIFICATION_DISPATCH_TOKEN");
  if (!expected) throw new Error("NOTIFICATION_DISPATCH_TOKEN missing");
  const token = req.headers.get("authorization")?.replace("Bearer", "").trim();
  if (!token || token !== expected) throw new Error("Unauthorized");
}

async function fetchPendingNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, tenant_id, entity, message, severity, metadata, created_at")
    .is("delivered_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) throw new Error(`Failed to load notifications: ${error.message}`);
  return data ?? [];
}

async function fetchWebhooks(tenantId: string) {
  const { data, error } = await supabase
    .from("outgoing_webhooks")
    .select("id, url, secret, event")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(`Failed to load webhooks: ${error.message}`);
  return data ?? [];
}

async function dispatchWebhook(url: string, secret: string | null, payload: unknown) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) headers["X-Signature"] = await crypto.subtle
    .importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(JSON.stringify(payload))))
    .then((buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join(""));

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Webhook failed: ${res.status} ${await res.text()}`);
  }
}

async function markDelivered(id: string) {
  const { error } = await supabase.from("notifications").update({ delivered_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`Failed to mark notification: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  try {
    assertAuthorized(req);
    const notifications = await fetchPendingNotifications();
    for (const notification of notifications) {
      const payload = {
        id: notification.id,
        entity: notification.entity,
        message: notification.message,
        severity: notification.severity,
        metadata: notification.metadata,
        created_at: notification.created_at,
      };
      const webhooks = await fetchWebhooks(notification.tenant_id);
      for (const webhook of webhooks) {
        if (webhook.event !== "notification.created") continue;
        try {
          await dispatchWebhook(webhook.url, webhook.secret, payload);
        } catch (error) {
          console.error(`Webhook ${webhook.url} failed`, error);
        }
      }
      await markDelivered(notification.id);
    }

    return new Response(JSON.stringify({ dispatched: notifications.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
  }
});
