import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.0";

const supabaseEnvKeys = [
  "PROJECT_SUPABASE_URL",
  "PROJECT_SERVICE_ROLE_KEY",
] as const;
const llmEnvKeys = ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL_ID"] as const;

type SupabaseEnvKey = typeof supabaseEnvKeys[number];
type LlmEnvKey = typeof llmEnvKeys[number];

type LlmMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

interface LlmRequest {
  messages: LlmMessage[];
  temperature?: number;
  response_format?: { type: "json_object" };
}

function ensureEnv<T extends string>(keys: readonly T[]): Record<T, string> {
  const env = {} as Record<T, string>;
  for (const key of keys) {
    const value = Deno.env.get(key);
    if (!value) {
      throw new Error(`Missing environment variable: ${key}`);
    }
    env[key] = value;
  }
  return env;
}

export async function callLlm(payload: LlmRequest) {
  const env = ensureEnv(llmEnvKeys);
  const response = await fetch(`${env.LLM_BASE_URL.trim()}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: env.LLM_MODEL_ID,
      ...payload,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  return await response.json();
}

export function getServiceClient() {
  const env = ensureEnv(supabaseEnvKeys);
  return createClient(env.PROJECT_SUPABASE_URL, env.PROJECT_SERVICE_ROLE_KEY, {
    auth: { detectSessionInUrl: false },
  });
}
