import { pairingHash, shortCode } from "./security";
import { channelCredential } from "./credentials.server";

type DmEvent = { id: string; event_type?: string; text?: string; sender_id?: string; created_at?: string };

async function xApi(token: string, path: string, init?: RequestInit) {
  const r = await fetch(`https://api.x.com${path}`, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers || {}) } });
  if (!r.ok) throw new Error(`X request failed (${r.status})`);
  return r.json();
}

/** Polls the official @Ceyobot inbox (run by the minute scheduler); each event is claimed once in channel_deliveries. */
export async function pollXMessages() {
  const token = await channelCredential("CEYO_XCHAT_TOKEN");
  const botId = await channelCredential("CEYO_XCHAT_USER_ID");
  if (!token || !botId) return { skipped: "not configured" };
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const page = await xApi(token, "/2/dm_events?max_results=50&event_types=MessageCreate&dm_event.fields=sender_id,text,created_at");
  const events: DmEvent[] = (page.data || []).filter((e: DmEvent) => e.sender_id && e.sender_id !== botId && e.text
    && Date.parse(e.created_at || "") > Date.now() - 15 * 60_000).reverse();
  let handled = 0;
  for (const e of events) {
    const send = (text: string) => xApi(token, `/2/dm_conversations/with/${e.sender_id}/messages`, { method: "POST", body: JSON.stringify({ text: text.slice(0, 9500) }) });
    const prior = await db.from("channel_deliveries").select("id").eq("platform", "xchat").eq("event_id", e.id).maybeSingle();
    if (prior.error || prior.data) continue;
    const claim = await db.from("channel_deliveries").insert({ platform: "xchat", event_id: e.id }).select("id").single();
    if (claim.error) continue; // another poll claimed it
    handled++;
    const deliveryId = claim.data.id;
    const externalId = String(e.sender_id);
    try {
      const code = shortCode(e.text!);
      if (code) {
        const r = await db.rpc("consume_channel_pairing", { p_platform: "xchat", p_external_user: externalId, p_token_hash: await pairingHash(`xchat:${code}`) });
        if (!r.error && r.data) {
          await db.from("channel_deliveries").update({ status: "completed", identity_id: r.data }).eq("id", deliveryId);
          await send("اتربط حسابك ✅ دلوقتي تقدر تكلمني هنا عادي، وكل حاجة بتتحفظ في حسابك.");
          continue;
        }
      }
      const { data: identity } = await db.from("channel_identities").select("*").eq("platform", "xchat").eq("external_user_id", externalId).maybeSingle();
      if (!identity) {
        await db.from("channel_deliveries").update({ status: "completed" }).eq("id", deliveryId);
        await send("أهلًا 👋 علشان أعرفك: افتح التطبيق وقول لوكيلك «عايز كود إكس»، وابعتلي الكود هنا خلال دقيقة.\nHi 👋 Ask your agent in the app for an X code and send it here within a minute.");
        continue;
      }
      await db.from("channel_deliveries").update({ identity_id: identity.id }).eq("id", deliveryId);
      const { agentReply } = await import("./agentReply.server");
      const text = await agentReply(db, identity, e.text!, deliveryId, "xchat");
      const pending = await db.from("channel_deliveries").update({ status: "sending" }).eq("id", deliveryId);
      if (pending.error) throw new Error("Receipt unavailable");
      await send(text);
      await db.from("channel_deliveries").update({ status: "completed" }).eq("id", deliveryId);
    } catch {
      await db.from("channel_deliveries").update({ status: "needs_review" }).eq("id", deliveryId);
    }
  }
  return { handled };
}
