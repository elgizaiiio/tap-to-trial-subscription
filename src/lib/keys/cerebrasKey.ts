/** @doc Server-only loader for the Cerebras API key — the base text model.
 *
 *  Cerebras serves the default chat turn because it is the fastest text path by
 *  a wide margin (measured at roughly 900 output tokens/second after the first
 *  token, against seconds-per-turn on the agent harness). Keys live in the
 *  shared `provider_api_keys` pool with provider "cerebras"; the environment
 *  variable is only a fallback so a deploy can be brought up before the row
 *  exists.
 *
 *  Load is spread across every active key: candidates are ordered by
 *  least-recently-used, and each use stamps `last_used_at` so the next request
 *  picks a different key. Failures put a key on cooldown (or mark it disabled)
 *  so the pool self-heals without a deploy.
 *  Never import this from client code.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface CerebrasKey {
  id: string;
  table: "provider_api_keys" | "env";
  api_key: string;
  failure_count: number;
  /** Set for CoArena keys: requests go to this endpoint with this model instead of Cerebras. */
  provider?: "coarena" | "cerebras";
}

/** CoArena (OpenAI-compatible) serves the strongest model first; Cerebras keys follow as the automatic fallback. */
export const COARENA_URL = "https://coarena.ai/api/v1/chat/completions";
export const COARENA_MODEL = "gpt-6-1-terra";

export const CEREBRAS_BASE = "https://api.cerebras.ai/v1";

/** The only two models Cerebras serves on shared inference. */
export const CEREBRAS_MODELS = {
  /** Default for every text/agent turn (owner chose Qwen over gpt-oss for answer quality). */
  text: "qwen-3.8-27b",
  /** The only one that accepts images. */
  vision: "qwen-3.8-27b",
} as const;

function envKey(): string {
  return (process.env.CEREBRAS_API_KEY || "").trim();
}

function adminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

/** Active CoArena keys not on cooldown (primary text model). */
async function getCoarenaKeys(supabase: SupabaseClient | null): Promise<CerebrasKey[]> {
  const out: CerebrasKey[] = [];
  if (supabase) {
    const now = Date.now();
    const { data } = await supabase
      .from("provider_api_keys")
      .select("id,api_key,cooldown_until,failure_count")
      .eq("provider", "coarena")
      .eq("status", "active")
      .order("last_used_at", { ascending: true, nullsFirst: true });
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const api_key = String(r.api_key ?? "").trim();
      const cd = r.cooldown_until as string | null;
      if (!api_key || (cd && new Date(cd).getTime() > now)) continue;
      out.push({ id: String(r.id), table: "provider_api_keys", api_key, failure_count: Number(r.failure_count ?? 0), provider: "coarena" });
    }
  }
  const env = (process.env.COARENA_API_KEY || "").trim();
  if (!out.length && env) out.push({ id: "env-coarena", table: "env", api_key: env, failure_count: 0, provider: "coarena" });
  return out;
}

/** Every usable key: CoArena first, then Cerebras least-recently-used first. */
export async function getCerebrasKeys(): Promise<CerebrasKey[]> {
  const supabase = adminClient();
  const coarena = await getCoarenaKeys(supabase);
  return [...coarena, ...(await getCerebrasOnlyKeys(supabase))];
}

async function getCerebrasOnlyKeys(supabase: SupabaseClient | null): Promise<CerebrasKey[]> {
  const rows: CerebrasKey[] = [];
  if (supabase) {
    const now = Date.now();
    const cooling: { until: number; key: CerebrasKey }[] = [];
    const { data } = await supabase
      .from("provider_api_keys")
      .select("id,api_key,last_used_at,cooldown_until,failure_count")
      .eq("provider", "cerebras")
      .eq("status", "active")
      .order("last_used_at", { ascending: true, nullsFirst: true });
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const api_key = String(r.api_key ?? "").trim();
      if (!api_key) continue;
      const cd = r.cooldown_until as string | null;
      if (cd && new Date(cd).getTime() > now) { cooling.push({ until: new Date(cd).getTime(), key: { id: String(r.id), table: "provider_api_keys", api_key, failure_count: Number(r.failure_count ?? 0) } }); continue; }
      rows.push({
        id: String(r.id),
        table: "provider_api_keys",
        api_key,
        failure_count: Number(r.failure_count ?? 0),
      });
    }
    // Only rate-limited keys left: still use them (soonest first); the request waits out Retry-After instead of failing the reply.
    if (!rows.length) rows.push(...cooling.sort((x, y) => x.until - y.until).map((c) => c.key));
  }
  if (!rows.length) {
    const key = envKey();
    if (key) rows.push({ id: "env", table: "env", api_key: key, failure_count: 0 });
  }
  return rows;
}

export async function hasCerebrasKey(): Promise<boolean> {
  return (await getCerebrasKeys()).length > 0;
}

export async function markCerebrasUse(key: CerebrasKey): Promise<void> {
  if (key.table === "env") return;
  const supabase = adminClient();
  if (!supabase) return;
  await supabase
    .from("provider_api_keys")
    .update({ last_used_at: new Date().toISOString(), failure_count: 0, last_error: null })
    .eq("id", key.id);
}

/**
 * `status` 402 means the account is out of credit, 429 means rate limited —
 * both are temporary, so the key goes on cooldown and the pool tries the next
 * one. Anything else that is not 4xx-shaped gets disabled outright.
 */
export async function markCerebrasFailure(
  key: CerebrasKey,
  status: number,
  error: string,
  retryAfterSeconds?: number,
): Promise<void> {
  if (key.table === "env") return;
  const supabase = adminClient();
  if (!supabase) return;
  const temporary = status === 402 || status === 429 || status >= 500;
  // CoArena busy (5xx) clears in seconds; its daily quota 429 resets at midnight UTC but a short cooldown re-probes cheaply.
  const cooldownSeconds = retryAfterSeconds ?? (key.provider === "coarena" ? (status >= 500 ? 20 : 120) : status === 429 ? 60 : 300);
  await supabase
    .from("provider_api_keys")
    .update({
      failure_count: key.failure_count + 1,
      last_error: `upstream_${status}`,
      status: temporary ? "active" : "disabled",
      cooldown_until: temporary
        ? new Date(Date.now() + cooldownSeconds * 1000).toISOString()
        : null,
    })
    .eq("id", key.id);
}
