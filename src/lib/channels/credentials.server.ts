export async function channelCredential(name: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("read_channel_credential", { p_name: name });
  if (error) throw new Error("Channel credential storage unavailable");
  return typeof data === "string" && data ? data : null;
}