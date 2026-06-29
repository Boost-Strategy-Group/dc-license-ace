// Server-only OpenAI base client + usage logging.
// SECURITY: imports the service-role supabase admin client and reads OPENAI_API_KEY.
// This file MUST stay `*.server.ts` so it never ships to the client bundle.
import OpenAI from "openai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Direct OpenAI API — NOT the Lovable AI gateway.
export const OPENAI_BASE_URL = "https://api.openai.com/v1";

// Real OpenAI model names. The product summary references gpt-5* names, but the
// current available models are gpt-4o / gpt-4o-mini.
export const MODELS = {
  MINI: "gpt-4o-mini",
  FULL: "gpt-4o",
  EMBED: "text-embedding-3-small",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

// USD per 1,000,000 tokens. Used only for a rough cost_estimate_usd — not billing.
const PRICE_PER_M: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICE_PER_M[model] ?? { input: 0, output: 0 };
  const cost = (promptTokens / 1_000_000) * p.input + (completionTokens / 1_000_000) * p.output;
  return Math.round(cost * 1_000_000) / 1_000_000; // numeric(10,6)
}

export function createOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY (server-only secret).");
  return new OpenAI({ apiKey, baseURL: OPENAI_BASE_URL });
}

// Many target tables (ai_usage_log, *_coach_sessions, pulse_ai_insights,
// potential_ratings) are created by later migrations and are not yet present in
// the generated Database types. Access them through this loose view.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type UntypedClient = { from: (table: string) => any };
export function untyped(client: unknown): UntypedClient {
  return client as UntypedClient;
}

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type AiUsageParams = {
  tenant_id: string | null;
  user_id: string;
  feature: string;
  model: string;
  usage: TokenUsage;
  metadata?: Record<string, unknown>;
};

// Writes one row to ai_usage_log using the service-role client (bypasses RLS).
// Logging failures must never break the feature, so errors are swallowed + logged.
export async function logAiUsage(params: AiUsageParams): Promise<void> {
  const { tenant_id, user_id, feature, model, usage, metadata } = params;
  try {
    await untyped(supabaseAdmin)
      .from("ai_usage_log")
      .insert({
        tenant_id,
        user_id,
        feature,
        model,
        prompt_tokens: usage.prompt_tokens ?? 0,
        completion_tokens: usage.completion_tokens ?? 0,
        total_tokens:
          usage.total_tokens ?? (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0),
        cost_estimate_usd: estimateCostUsd(
          model,
          usage.prompt_tokens ?? 0,
          usage.completion_tokens ?? 0,
        ),
        metadata: { tenant_id, user_id, feature, ...(metadata ?? {}) },
      });
  } catch (err) {
    console.error("[ai_usage_log] failed to record AI usage", err);
  }
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "");
}

export type ChatJsonResult<T> = { data: T; usage: TokenUsage };

// Runs a chat completion in JSON mode and parses the result. Returns the parsed
// object plus token usage so callers can log to ai_usage_log.
export async function chatJson<T = Record<string, unknown>>(args: {
  client: OpenAI;
  model: ModelName;
  system: string;
  user: string;
  temperature?: number;
}): Promise<ChatJsonResult<T>> {
  const { client, model, system, user, temperature } = args;
  const completion = await client.chat.completions.create({
    model,
    temperature: temperature ?? 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: system + "\n\nReturn ONLY a single valid JSON object. No markdown, no commentary.",
      },
      { role: "user", content: user },
    ],
  });

  const raw = completion.choices?.[0]?.message?.content ?? "";
  const cleaned = stripFences(raw);
  let data: T;
  try {
    data = JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      data = JSON.parse(cleaned.slice(start, end + 1)) as T;
    } else {
      throw new Error("OpenAI returned invalid JSON");
    }
  }

  const u = completion.usage;
  const usage: TokenUsage = {
    prompt_tokens: u?.prompt_tokens ?? 0,
    completion_tokens: u?.completion_tokens ?? 0,
    total_tokens: u?.total_tokens ?? 0,
  };

  return { data, usage };
}
