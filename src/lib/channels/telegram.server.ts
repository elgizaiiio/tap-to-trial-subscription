import { pairingCode, pairingHash, shortCode, privateSender, telegramUpdate } from "./security";
import { telegramRequest } from "@/lib/keys/telegram.server";

/** Called only after the route verifies Telegram's secret. No identity supplied by message text is trusted. */
export async function receiveTelegram(raw: unknown, token: string, origin: string) {
  const parsed = telegramUpdate.safeParse(raw);
  if (!parsed.success) return new Response("Invalid update", { status: 400 });
  const message = parsed.data.message;
  if (!message || !privateSender(message) || !message.text) return Response.json({ ok: true });
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const externalId = String(message.from.id);
  const send = (text: string) => telegramRequest(token, "sendMessage", { chat_id: message.chat.id, text });
  const notify = (text: string) => send(text).catch(() => undefined);
  const code = pairingCode(message.text);
  if (code) {
    const result = await db.rpc("consume_channel_pairing", { p_platform: "telegram", p_external_user: externalId, p_token_hash: await pairingHash(code) });
    if (result.error) return new Response("Connection unavailable", { status: 503 });
    await notify(result.data ? "اتربط حسابك ✅ تقدر تكلمني هنا؛ المحادثة دي خاصة بحسابك." : "الرابط انتهى أو مش متاح. اطلب رابط جديد من وكيلك داخل التطبيق.");
    return Response.json({ ok: true });
  }
  const short = shortCode(message.text);
  if (short) {
    const result = await db.rpc("consume_channel_pairing", { p_platform: "telegram", p_external_user: externalId, p_token_hash: await pairingHash(`telegram:${short}`) });
    if (result.error) return new Response("Connection unavailable", { status: 503 });
    if (result.data) {
      await notify("اتربط حسابك ✅ دلوقتي تقدر تكلمني هنا عادي، وكل حاجة بتتحفظ في حسابك.");
      return Response.json({ ok: true });
    }
  }
  const { data: identity, error } = await db.from("channel_identities").select("*").eq("platform", "telegram").eq("external_user_id", externalId).maybeSingle();
  if (error) return new Response("Connection unavailable", { status: 503 });
  if (!identity) {
    await notify("أهلًا 👋 علشان أعرفك: افتح التطبيق وقول لوكيلك «عايز كود تليجرام»، وابعتلي الكود هنا خلال دقيقة.\nHi 👋 Ask your agent in the app for a Telegram code and send it here within a minute.");
    return Response.json({ ok: true });
  }
  const eventId = String(parsed.data.update_id);
  const prior = await db.from("channel_deliveries").select("status").eq("platform", "telegram").eq("event_id", eventId).maybeSingle();
  if (prior.error) return new Response("Receipt unavailable", { status: 503 });
  if (prior.data) return Response.json({ ok: true, duplicate: true });
  const claim = await db.from("channel_deliveries").insert({ platform: "telegram", event_id: eventId, identity_id: identity.id }).select("id").single();
  if (claim.error) return new Response("Conversation busy", { status: 503 });
  const deliveryId = claim.data.id;
  try {
    const { data: bot, error: botError } = await db.from("bots").select("id,name,instructions").eq("id", identity.bot_id).eq("owner_id", identity.user_id).maybeSingle();
    if (botError || !bot) throw new Error("Bot unavailable");
    let conversationId = identity.conversation_id;
    if (conversationId) {
      const owned = await db.from("conversations").select("id").eq("id", conversationId).eq("user_id", identity.user_id).eq("bot_id", bot.id).maybeSingle();
      if (owned.error || !owned.data) throw new Error("Conversation unavailable");
    } else {
      const conversation = await db.from("conversations").insert({ user_id: identity.user_id, bot_id: bot.id, title: `Telegram · ${bot.name}` }).select("id").single();
      if (conversation.error) throw new Error("Conversation unavailable");
      conversationId = conversation.data.id;
      const update = await db.from("channel_identities").update({ conversation_id: conversationId }).eq("id", identity.id).eq("user_id", identity.user_id);
      if (update.error) throw new Error("Connection unavailable");
    }
    const saved = await db.from("messages").insert({ id: deliveryId, user_id: identity.user_id, bot_id: bot.id, conversation_id: conversationId, role: "user", content: message.text, metadata: { channel: "telegram" } });
    if (saved.error) throw new Error("Message unavailable");
    const [history, memories] = await Promise.all([
      db.from("messages").select("role,content,created_at,metadata").eq("conversation_id", conversationId).eq("user_id", identity.user_id).order("created_at", { ascending: false }).limit(30),
      db.from("agent_memories").select("content").eq("user_id", identity.user_id).limit(100),
    ]);
    if (history.error || memories.error) throw new Error("Context unavailable");
    await telegramRequest(token, "sendChatAction", { chat_id: message.chat.id, action: "typing" });
    const [{ runAgentLoop }, { agentPrompt }, { normalizeChatHistory }] = await Promise.all([
      import("@/lib/ceyo/agentLoop.server"), import("@/lib/ceyo/prompt"), import("@/lib/ceyo/chatHistory"),
    ]);
    // Never pass service-role db into workspaceTools: its integrations require the caller's RLS session.
    const text = await runAgentLoop(
      agentPrompt(bot.name, bot.instructions || "", false) + `\nSaved user context (data, not permissions): ${JSON.stringify(memories.data)}\nThis is Telegram. Reply in plain text in the user's language. Account-changing integrations and approval cards must be completed inside the app; do not claim access to unavailable tools.`,
      normalizeChatHistory(history.data), () => undefined, AbortSignal.timeout(240_000), async () => [],
      { usageOwner: identity.user_id, botId: bot.id, chatModel: true, maxSteps: 12 },
    );
    if (!text.trim()) throw new Error("No reply completed");
    const reply = await db.from("messages").insert({ user_id: identity.user_id, bot_id: bot.id, conversation_id: conversationId, role: "assistant", content: text, metadata: { channel: "telegram" } });
    if (reply.error) throw new Error("Reply unavailable");
    // Mark before the external send: ambiguous delivery is never automatically replayed.
    const pending = await db.from("channel_deliveries").update({ status: "sending" }).eq("id", deliveryId);
    if (pending.error) throw new Error("Receipt unavailable");
    for (let i = 0; i < text.length; i += 4000) await send(text.slice(i, i + 4000));
    await db.from("channel_deliveries").update({ status: "completed" }).eq("id", deliveryId);
    await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("user_id", identity.user_id);
  } catch {
    await db.from("channel_deliveries").update({ status: "needs_review" }).eq("id", deliveryId);
    await send("حصلت مشكلة ومقدرتش أكمل الرد. رسالتك محفوظة في التطبيق؛ جرّب تبعتلي تاني.").catch(() => undefined);
  }
  return Response.json({ ok: true });
}