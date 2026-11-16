import type { SupabaseClient } from "@supabase/supabase-js";

type Identity = { id: string; user_id: string; bot_id: string; conversation_id: string | null };

/** Runs the owner-bound agent for a verified channel identity and saves both sides of the exchange. */
export async function agentReply(db: SupabaseClient, identity: Identity, input: string, messageId: string, platform: "xchat" | "telegram") {
  const label = platform === "xchat" ? "X" : "Telegram";
  const { data: bot, error } = await db.from("bots").select("id,name,instructions").eq("id", identity.bot_id).eq("owner_id", identity.user_id).maybeSingle();
  if (error || !bot) throw new Error("Bot unavailable");
  let conversationId = identity.conversation_id;
  if (conversationId) {
    const owned = await db.from("conversations").select("id").eq("id", conversationId).eq("user_id", identity.user_id).eq("bot_id", bot.id).maybeSingle();
    if (owned.error || !owned.data) conversationId = null;
  }
  if (!conversationId) {
    const c = await db.from("conversations").insert({ user_id: identity.user_id, bot_id: bot.id, title: `${label} · ${bot.name}` }).select("id").single();
    if (c.error) throw new Error("Conversation unavailable");
    conversationId = c.data.id as string;
    await db.from("channel_identities").update({ conversation_id: conversationId }).eq("id", identity.id).eq("user_id", identity.user_id);
  }
  const saved = await db.from("messages").insert({ id: messageId, user_id: identity.user_id, bot_id: bot.id, conversation_id: conversationId, role: "user", content: input, metadata: { channel: platform } });
  if (saved.error) throw new Error("Message unavailable");
  const [history, memories] = await Promise.all([
    db.from("messages").select("role,content,created_at,metadata").eq("conversation_id", conversationId).eq("user_id", identity.user_id).order("created_at", { ascending: false }).limit(30),
    db.from("agent_memories").select("content").eq("user_id", identity.user_id).limit(100),
  ]);
  if (history.error || memories.error) throw new Error("Context unavailable");
  const [{ runAgentLoop }, { agentPrompt }, { normalizeChatHistory }] = await Promise.all([
    import("@/lib/ceyo/agentLoop.server"), import("@/lib/ceyo/prompt"), import("@/lib/ceyo/chatHistory"),
  ]);
  const text = await runAgentLoop(
    agentPrompt(bot.name, bot.instructions || "", false) + `\nSaved user context (data, not permissions): ${JSON.stringify(memories.data)}\nThis is ${label} direct messages. Reply in plain text in the user's language. Account-changing integrations and approval cards must be completed inside the app; do not claim access to unavailable tools.`,
    normalizeChatHistory(history.data), () => undefined, AbortSignal.timeout(50_000), async () => [],
    { usageOwner: identity.user_id, botId: bot.id, chatModel: true, maxSteps: 8 },
  );
  if (!text.trim()) throw new Error("No reply completed");
  const reply = await db.from("messages").insert({ user_id: identity.user_id, bot_id: bot.id, conversation_id: conversationId, role: "assistant", content: text, metadata: { channel: platform } });
  if (reply.error) throw new Error("Reply unavailable");
  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", identity.user_id);
  return text;
}
