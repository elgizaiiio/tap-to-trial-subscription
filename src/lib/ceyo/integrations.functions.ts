import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

export const integrationAccounts = createServerFn({ method: "POST" }).handler(async () => {
  const { authenticate } = await import("./auth.server");
  const { accounts } = await import("./composio.server");
  const { userId } = await authenticate(getRequest());
  return { accounts: await accounts(userId) };
});
export const integrationConnect = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ app: z.string().min(1).max(100) }).parse(input))
  .handler(async ({ data }) => {
    const { authenticate } = await import("./auth.server");
    const { connectAccount } = await import("./composio.server");
    const request = getRequest();
    const { userId } = await authenticate(request);
    const origin = new URL(request.url).origin;
    return { url: await connectAccount(userId, data.app, `${origin}/connected?app=${encodeURIComponent(data.app)}`) };
  });
export const integrationDisconnect = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ accountId: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { authenticate } = await import("./auth.server");
    const { ownedAccount, composio } = await import("./composio.server");
    const { userId } = await authenticate(getRequest());
    await ownedAccount(userId, data.accountId);
    await composio(`/connected_accounts/${encodeURIComponent(data.accountId)}`, "DELETE");
    return { ok: true };
  });
export const integrationApproval = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid(), approved: z.boolean(), always: z.boolean().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { authenticate } = await import("./auth.server");
    const { executeAction, accounts: listAccounts } = await import("./composio.server");
    const { db, userId } = await authenticate(getRequest());
    const { data: pending, error } = await db.from("agent_action_requests").select("*").eq("id", data.id).eq("user_id", userId).single();
    if (error || !pending) throw new Error("Request not found");
    if (pending.status !== "pending") return { status: pending.status };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed, error: claimError } = await supabaseAdmin.from("agent_action_requests").update({ status: data.approved ? "running" : "rejected" }).eq("id", pending.id).eq("user_id", userId).eq("status", "pending").select("id");
    if (claimError) throw new Error(claimError.message);
    if (!claimed?.length) return { status: "running" };
    if (!data.approved) return { status: "rejected" };
    if (data.always) {
      // "Always allow" is the user's own choice for this app; stored where only the server can write it.
      const app = (await listAccounts(userId)).find((a: { id: string }) => a.id === pending.account_id)?.app;
      if (app) {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
        const list = new Set<string>(Array.isArray(u.user?.app_metadata?.auto_approve_apps) ? u.user.app_metadata.auto_approve_apps : []);
        list.add(String(app));
        await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { ...(u.user?.app_metadata || {}), auto_approve_apps: [...list] } });
      }
    }
    let result;
    try {
      result = await executeAction(userId, { account_id: pending.account_id, tool_slug: pending.tool_slug, arguments: pending.arguments });
    } catch (error) {
      await supabaseAdmin.from("agent_action_requests").update({ status: "failed" }).eq("id", pending.id).eq("user_id", userId);
      throw error;
    }
    const { error: writeError } = await supabaseAdmin.from("agent_action_requests").update({ status: "completed", result }).eq("id", pending.id).eq("user_id", userId);
    if (writeError) throw new Error("The action ran, but its receipt could not be saved. Do not repeat the action.");
    const { error: deliveryError } = await db.from("messages").upsert({ id: pending.id, user_id: userId, conversation_id: pending.conversation_id, role: "assistant", content: `✓ ${pending.tool_slug.replace(/_/g, " ").toLowerCase()}`, metadata: { internal: true, action_id: pending.id, action_result: JSON.stringify(result.data || result).slice(0, 4000) } }, { onConflict: "id", ignoreDuplicates: true });
    if (deliveryError) throw new Error("The action completed, but its chat receipt could not be saved.");
    return { status: "completed" };
  });
export const integrationApprovalStatus = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { authenticate } = await import("./auth.server");
    const { db, userId } = await authenticate(getRequest());
    const { data: request, error } = await db.from("agent_action_requests").select("status").eq("id", data.id).eq("user_id", userId).single();
    if (error) throw new Error(error.message);
    return { status: request.status };
  });