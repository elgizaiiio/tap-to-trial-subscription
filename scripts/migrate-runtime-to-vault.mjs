// Operator-only: run in the old hosting environment before disconnecting it.
// No credentials are returned, printed, written to files, or copied into Git.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Existing hosting Supabase binding is required.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (input, init) => {
  const headers = new Headers(init?.headers);
  if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
  headers.set("apikey", key);
  return fetch(input, { ...init, headers });
} } });

const sources = {
  CEYO_CRON_SECRET: process.env.CEYO_CRON_SECRET || process.env.LOVABLE_CRON_SECRET,
  CEYO_GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  CEYO_SMTP_HOST: process.env.HOSTINGER_SMTP_HOST,
  CEYO_SMTP_PORT: process.env.HOSTINGER_SMTP_PORT,
  CEYO_SMTP_USER: process.env.HOSTINGER_SMTP_USER,
  CEYO_SMTP_PASSWORD: process.env.HOSTINGER_SMTP_PASSWORD,
  CEYO_SMTP_FROM: process.env.HOSTINGER_SMTP_FROM,
};
for (const [name, value] of Object.entries(sources)) {
  if (!value) { console.log(`${name}: source unavailable; not migrated`); continue; }
  const existing = await db.rpc("read_runtime_credential", { p_name: name });
  if (existing.error) throw new Error("Vault read unavailable; migration stopped.");
  if (existing.data && existing.data !== value) throw new Error("Existing Vault value differs; coordinate callback rotation before replacement.");
  if (!existing.data) {
    const saved = await db.rpc("store_runtime_credential", { p_name: name, p_value: value });
    if (saved.error) throw new Error("Vault save failed; migration stopped.");
  }
  const check = await db.rpc("read_runtime_credential", { p_name: name });
  if (check.error || check.data !== value) throw new Error("Vault read-back failed; migration unverified.");
  console.log(`${name}: saved and verified in external Supabase Vault`);
}