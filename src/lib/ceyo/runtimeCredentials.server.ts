export async function runtimeCredential(name: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("read_runtime_credential", { p_name: name });
  if (error) throw new Error("Runtime credential storage unavailable");
  return typeof data === "string" && data ? data : null;
}

/** The original signing value was migrated unchanged: existing signatures stay valid. */
export async function schedulerSecret(): Promise<string | null> {
  return runtimeCredential("CEYO_CRON_SECRET");
}