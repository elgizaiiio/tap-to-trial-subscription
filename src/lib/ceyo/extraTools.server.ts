import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HOOK_PATH, HOSTED_BOT_MIME, HOSTED_UPDATES, hostedBotConfig, hostedBotSecret, publicHookOrigin } from "./telegramHosting";
import { publicBrowserUrl } from "@/lib/computer/browserRules";
import type { AgentTool } from "./toolSchemas";
import { tool } from "./toolSchemas";

/** Extra general-purpose agent tools: public HTTP/APIs, Telegram Bot API and keyless data sources. */
const str = { type: "string" };
const clip = (s: string, n = 15000) => (s.length > n ? `${s.slice(0, n)}\n…[truncated]` : s);
async function getJson(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": "CeyoAgent/1.0", Accept: "application/json" } });
  if (!r.ok) throw new Error(`Request failed (${r.status})`);
  return r.json();
}

export function extraTools(ctx?: { db: SupabaseClient; userId: string; origin?: string }): AgentTool[] {
  const list: AgentTool[] = [];
  const add = (name: string, description: string, props: object, required: string[], run: AgentTool["run"]) => list.push({ name, def: tool(name, description, props, required), run });

  add("http_request", "Call ANY public HTTP API or URL (GET/POST/PUT/PATCH/DELETE) with headers and JSON/text body; returns status, headers and body. Use it to act through external services' APIs yourself instead of telling the user to do it.", { url: str, method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] }, headers: { type: "object" }, body: { type: "string", description: "Request body; JSON text for APIs" } }, ["url"], async (args) => {
    const input = z.object({ url: z.string().url(), method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"), headers: z.record(z.string()).optional(), body: z.unknown().optional() }).parse(args);
    const url = publicBrowserUrl(input.url);
    const headers: Record<string, string> = { "User-Agent": "CeyoAgent/1.0", ...(input.headers || {}) };
    let body: string | undefined;
    if (input.body !== undefined && input.method !== "GET") {
      body = typeof input.body === "string" ? input.body : JSON.stringify(input.body);
      if (typeof input.body !== "string" && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) headers["Content-Type"] = "application/json";
    }
    const r = await fetch(url, { method: input.method, headers, body, redirect: "follow" });
    const text = await r.text();
    return JSON.stringify({ status: r.status, ok: r.ok, content_type: r.headers.get("content-type"), body: clip(text) });
  });

  add("telegram_bot", "Operate a Telegram bot directly with its BotFather token (Bot API). method examples: getMe, sendMessage, sendPhoto, setMyCommands, setMyDescription, getUpdates, deleteWebhook, setWebhook, getChat. Special method 'reply_start' answers pending /start messages once. To keep a bot answering 24/7 use host_telegram_bot instead. A bot can never message a person first: never ask the user for chat_id — give them https://t.me/<username> and ask them to press Start.", { token: str, method: str, params: { type: "object" }, reply_text: str, reply_all: { type: "boolean" } }, ["token", "method"], async (args) => {
    const input = z.object({ token: z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/, "Invalid bot token"), method: z.string().regex(/^[A-Za-z_]{2,40}$/), params: z.record(z.unknown()).optional(), reply_text: z.string().max(4000).optional(), reply_all: z.boolean().optional() }).parse(args);
    const call = async (method: string, params: unknown = {}) => {
      const r = await fetch(`https://api.telegram.org/bot${input.token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
      const j = (await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }))) as { ok: boolean; result?: any; description?: string };
      if (!j.ok) throw new Error(`Telegram: ${j.description || "request failed"}`);
      return j.result;
    };
    if (input.method === "reply_start") {
      if (!input.reply_text) throw new Error("reply_text required");
      const hook = (await call("getWebhookInfo")) as { url?: string };
      if (hook.url?.includes(HOOK_PATH)) return JSON.stringify({ hosted: true, note: "This bot is already hosted 24/7 and answers by itself; nothing to poll." });
      await call("deleteWebhook", { drop_pending_updates: false });
      const updates = (await call("getUpdates", { timeout: 0, limit: 100 })) as any[];
      let replied = 0, last = 0;
      for (const u of updates) {
        last = Math.max(last, u.update_id);
        const m = u.message;
        if (!m?.chat?.id) continue;
        if (input.reply_all || /^\/start\b/.test(m.text || "")) { await call("sendMessage", { chat_id: m.chat.id, text: input.reply_text }); replied++; }
      }
      if (last) await call("getUpdates", { offset: last + 1, limit: 1, timeout: 0 });
      return JSON.stringify({ processed: updates.length, replied });
    }
    return clip(JSON.stringify(await call(input.method, input.params || {})));
  });

  if (ctx) {
    const tg = async (token: string, method: string, params: unknown = {}) => {
      const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
      const j = (await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }))) as { ok: boolean; result?: any; description?: string };
      if (!j.ok) throw new Error(`Telegram: ${j.description || "request failed"}`);
      return j.result;
    };
    const tokenSchema = z.string().regex(/^\d+:[A-Za-z0-9_-]{20,}$/, "Invalid bot token");
    add("host_telegram_bot", "Run the user's Telegram bot 24/7 on Ceyo's server (no routine, no user server). mode 'ai_chat' answers every message with AI using persona; 'auto_reply' sends fixed replies. Always set start_text (the /start welcome). Re-run to change texts. Everything the bot receives (its own chats, groups/channels where it is admin, and the user's personal chats once they link it to their account via Telegram Business) is saved for read_telegram_messages. business_reply=true lets it answer people in the user's personal chats — only when the user asked for that. It self-tests and returns the bot link: give the user https://t.me/<username> and tell them to press Start — never ask for chat_id.", { business_reply: { type: "boolean", description: "Answer people in the user's personal chats (Telegram Business). Default false = only read them." }, token: str, mode: { type: "string", enum: ["ai_chat", "auto_reply"] }, start_text: str, persona: { type: "string", description: "Who the bot is and how it answers (ai_chat)" }, default_reply: { type: "string", description: "Reply for other messages (auto_reply) or when AI is unavailable" }, commands: { type: "array", items: { type: "object", properties: { command: str, description: str, reply: str }, required: ["command", "description"] } } }, ["token", "start_text"], async (args) => {
      const input = z.object({ token: tokenSchema, mode: z.enum(["ai_chat", "auto_reply"]).default("ai_chat"), start_text: z.string().min(1).max(4000), persona: z.string().max(4000).optional(), default_reply: z.string().max(4000).optional(), commands: z.array(z.object({ command: z.string().transform((c) => c.replace(/^\//, "").toLowerCase()), description: z.string().min(1).max(256), reply: z.string().max(4000).optional() })).max(30).optional(), business_reply: z.boolean().default(false) }).parse(args);
      const { schedulerSecret } = await import("./runtimeCredentials.server");
      const secret = await schedulerSecret();
      if (!secret) throw new Error("Bot hosting is not configured on this server");
      const me = (await tg(input.token, "getMe")) as { id: number; username: string; first_name?: string };
      const cfg = hostedBotConfig.parse({ v: 1, bot_id: me.id, username: me.username, mode: input.mode, start_text: input.start_text, persona: input.persona, default_reply: input.default_reply, business_reply: input.business_reply, commands: (input.commands || []).filter((c) => c.command !== "start") });
      const name = `telegram-bot:${me.id}`;
      const { data: existing, error: findError } = await ctx.db.from("agent_documents").select("id").eq("user_id", ctx.userId).eq("name", name).eq("mime", HOSTED_BOT_MIME).maybeSingle();
      if (findError) throw new Error(findError.message);
      let docId = existing?.id as string | undefined;
      if (docId) {
        const { error } = await ctx.db.from("agent_documents").update({ content: JSON.stringify(cfg), updated_at: new Date().toISOString() }).eq("id", docId).eq("user_id", ctx.userId);
        if (error) throw new Error(error.message);
      } else {
        const { data, error } = await ctx.db.from("agent_documents").insert({ user_id: ctx.userId, name, mime: HOSTED_BOT_MIME, content: JSON.stringify(cfg) }).select("id").single();
        if (error) throw new Error(error.message);
        docId = data.id as string;
      }
      const { independentAppOrigin } = await import("./runtimeConfig");
      const origin = independentAppOrigin(process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://web.ceyo.si");
      const url = `${origin}${HOOK_PATH}${docId}`;
      if (!docId) throw new Error("Bot configuration unavailable");
      const secretToken = await hostedBotSecret(secret, docId);
      await tg(input.token, "setWebhook", { url, secret_token: secretToken, allowed_updates: HOSTED_UPDATES, drop_pending_updates: false });
      await tg(input.token, "setMyCommands", { commands: [{ command: "start", description: "Start" }, ...cfg.commands.map(({ command, description }) => ({ command, description }))] });
      // Self-test: send our own webhook a fake /start and check that it answers.
      let selfTest = "not run";
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secretToken }, body: JSON.stringify({ update_id: 0, message: { chat: { id: 1, type: "private" }, text: "/start" } }) });
        const j = (await r.json().catch(() => null)) as { method?: string; text?: string } | null;
        selfTest = r.ok && j?.method === "sendMessage" && j.text === cfg.start_text ? "passed" : `failed (HTTP ${r.status})`;
      } catch (error) { selfTest = `failed (${error instanceof Error ? error.message : "unreachable"})`; }
      const info = (await tg(input.token, "getWebhookInfo")) as { url?: string; pending_update_count?: number; last_error_message?: string };
      return JSON.stringify({ hosted: info.url === url, self_test: selfTest, bot: `@${me.username}`, link: `https://t.me/${me.username}`, mode: cfg.mode, pending_messages: info.pending_update_count ?? 0, last_error: info.last_error_message || null, note: "Runs 24/7 on Ceyo's server. Tell the user to open the link and press Start; the bot cannot message them first. To let you read their personal chats: Telegram app → Settings → Telegram Business → Chatbots → add @" + me.username + " (needs Telegram Premium). To read a group/channel: add the bot there as admin. Then use read_telegram_messages." });
    });
    add("read_telegram_messages", "Read messages that reached the user's hosted Telegram bots: their personal chats (after linking the bot in Telegram → Settings → Telegram Business → Chatbots), groups/channels where the bot is admin, and chats with the bot. Only messages that arrived after the bot was hosted and linked exist; Telegram never gives bots older history. Summarize for the user in plain words.", { bot: { type: "string", description: "Bot username; omit for all bots" }, kind: { type: "string", enum: ["all", "business", "private", "group", "channel"] }, search: str, limit: { type: "number" } }, [], async (args) => {
      const input = z.object({ bot: z.string().max(64).optional(), kind: z.enum(["all", "business", "private", "group", "channel"]).default("all"), search: z.string().max(200).optional(), limit: z.number().int().min(1).max(200).default(50) }).parse(args);
      const { data: bots, error: botError } = await ctx.db.from("agent_documents").select("id,content").eq("user_id", ctx.userId).eq("mime", HOSTED_BOT_MIME);
      if (botError) throw new Error(botError.message);
      const hosted = (bots || []).map((b) => ({ id: b.id as string, cfg: hostedBotConfig.safeParse(JSON.parse((b.content as string) || "{}")) })).filter((b) => b.cfg.success).map((b) => ({ id: b.id, username: b.cfg.data!.username }));
      const wanted = input.bot ? hosted.filter((b) => b.username.toLowerCase() === input.bot!.replace(/^@/, "").toLowerCase()) : hosted;
      if (!wanted.length) return JSON.stringify({ messages: [], note: hosted.length ? "That bot is not hosted; hosted bots: " + hosted.map((b) => "@" + b.username).join(", ") : "No hosted bot yet. Ask for the bot token (from @BotFather) and call host_telegram_bot first." });
      let q = ctx.db.from("telegram_inbox").select("kind,chat_title,from_name,outgoing,text,created_at,doc_id").eq("user_id", ctx.userId).in("doc_id", wanted.map((b) => b.id)).order("created_at", { ascending: false }).limit(input.limit);
      if (input.kind !== "all") q = q.eq("kind", input.kind);
      if (input.search) q = q.ilike("text", `%${input.search.replace(/[%_\\]/g, "")}%`);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      const names = new Map(wanted.map((b) => [b.id, "@" + b.username]));
      const linked = (data || []).some((m) => m.kind === "business_connection" || m.kind === "business");
      return JSON.stringify({ messages: (data || []).reverse().map((m) => ({ bot: names.get(m.doc_id as string), where: m.kind, chat: m.chat_title, from: m.outgoing ? "the user (you)" : m.from_name, text: m.text, at: m.created_at })), note: data?.length ? undefined : linked ? "No new messages yet." : "Nothing received yet. If the user wants their personal chats read, tell them in simple words: open Telegram → Settings → Telegram Business → Chatbots → type the bot's username → allow it (needs Telegram Premium). Groups/channels: add the bot as admin. Only new messages from then on can be read." });
    });
    add("publish_website", "Publish a web page (store, landing page, menu, portfolio, form, mini app) and get a live public link to give the user — never tell them to upload or host files themselves. html = one complete self-contained HTML document (inline CSS/JS; max ~95k characters), modern and mobile-first. Never invent image URLs: use image URLs a tool returned, or keyword photos like https://loremflickr.com/800/800/tshirt,white?lock=1 (change keywords and lock number per image). Mark sample prices/texts you made up and tell the user to send the real ones. For orders/contact use WhatsApp (https://wa.me/<number>), mailto: or a Telegram bot link. Pass site_id to update a page you published before.", { title: str, html: str, site_id: str }, ["title", "html"], async (args) => {
      const input = z.object({ title: z.string().min(1).max(120), html: z.string().min(20).max(95_000), site_id: z.string().uuid().optional() }).parse(args);
      const SITE = "text/html; ceyo-site";
      const name = `site:${input.title}`.slice(0, 200);
      let id = input.site_id;
      if (id) {
        const { data, error } = await ctx.db.from("agent_documents").update({ content: input.html, name }).eq("id", id).eq("user_id", ctx.userId).eq("mime", SITE).select("id").maybeSingle();
        if (error) throw new Error(error.message);
        if (!data) throw new Error("No published page with that site_id");
      } else {
        const { data, error } = await ctx.db.from("agent_documents").insert({ user_id: ctx.userId, name, mime: SITE, content: input.html }).select("id").single();
        if (error) throw new Error(error.message);
        id = data.id as string;
      }
      const { independentAppOrigin } = await import("./runtimeConfig");
      const origin = independentAppOrigin(process.env.APP_URL || process.env.PUBLIC_APP_URL || "https://web.ceyo.si");
      const url = `${origin}/api/public/site/${id}`;
      const check = await fetch(url).then((r) => r.status).catch(() => 0);
      return JSON.stringify({ published: check === 200, url, site_id: id, note: check === 200 ? "Live now. Give the user this link." : `Saved, but the link answered HTTP ${check}; it may need a moment.` });
    });
    add("stop_telegram_bot", "Stop hosting a Telegram bot that host_telegram_bot started.", { token: str }, ["token"], async (args) => {
      const { token } = z.object({ token: tokenSchema }).parse(args);
      const me = (await tg(token, "getMe")) as { id: number; username: string };
      await tg(token, "deleteWebhook", { drop_pending_updates: false });
      const { error } = await ctx.db.from("agent_documents").delete().eq("user_id", ctx.userId).eq("name", `telegram-bot:${me.id}`).eq("mime", HOSTED_BOT_MIME);
      if (error) throw new Error(error.message);
      return JSON.stringify({ stopped: true, bot: `@${me.username}` });
    });
  }

  add("weather", "Current weather and 3-day forecast for a city (keyless).", { city: str }, ["city"], async (args) => {
    const { city } = z.object({ city: z.string().min(1).max(100) }).parse(args);
    const geo: any = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(city)}`);
    const p = geo.results?.[0]; if (!p) throw new Error("City not found");
    const w = await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`);
    return JSON.stringify({ place: `${p.name}, ${p.country}`, ...w });
  });
  add("exchange_rate", "Live currency exchange rates (keyless).", { base: str, to: str }, ["base"], async (args) => {
    const { base, to } = z.object({ base: z.string().length(3), to: z.string().optional() }).parse(args);
    const j: any = await getJson(`https://open.er-api.com/v6/latest/${base.toUpperCase()}`);
    return JSON.stringify(to ? { base, to, rate: j.rates?.[to.toUpperCase()], updated: j.time_last_update_utc } : { base, rates: j.rates, updated: j.time_last_update_utc });
  });
  add("crypto_price", "Live crypto prices in USD by CoinGecko ids (comma separated, e.g. bitcoin,ethereum).", { ids: str }, ["ids"], async (args) => {
    const { ids } = z.object({ ids: z.string().regex(/^[a-z0-9,-]{1,300}$/) }).parse(args);
    return JSON.stringify(await getJson(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`));
  });
  add("wikipedia", "Get a Wikipedia summary for a topic in any language (lang like en, ar).", { topic: str, lang: str }, ["topic"], async (args) => {
    const { topic, lang } = z.object({ topic: z.string().min(1).max(200), lang: z.string().regex(/^[a-z]{2,3}$/).default("en") }).parse(args);
    const s: any = await getJson(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(topic)}`);
    const title = s.query?.search?.[0]?.title; if (!title) throw new Error("No article found");
    const j: any = await getJson(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
    return JSON.stringify({ title: j.title, extract: j.extract, url: j.content_urls?.desktop?.page });
  });
  add("news_feed", "Read latest items from any RSS/Atom feed URL, or Google News for a query.", { url: str, query: str }, [], async (args) => {
    const { url, query } = z.object({ url: z.string().url().optional(), query: z.string().max(200).optional() }).parse(args);
    const target = url ? publicBrowserUrl(url) : `https://news.google.com/rss/search?q=${encodeURIComponent(query || "news")}`;
    const xml = await (await fetch(target, { headers: { "User-Agent": "CeyoAgent/1.0" } })).text();
    const items = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/g)].slice(0, 15).map((m) => {
      const b = m[0]; const g = (t: string) => (new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`).exec(b)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").trim();
      return { title: g("title"), link: g("link") || /href="([^"]+)"/.exec(b)?.[1], date: g("pubDate") || g("updated") };
    });
    return JSON.stringify(items);
  });
  add("qr_code", "Create a QR code image link for any text or URL.", { text: str }, ["text"], async (args) => {
    const { text } = z.object({ text: z.string().min(1).max(1500) }).parse(args);
    return JSON.stringify({ image_url: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`, instruction: "Show it as a markdown image." });
  });
  add("current_time", "Get the exact current date and time in any IANA time zone (e.g. Africa/Cairo).", { timezone: str }, [], async (args) => {
    const { timezone } = z.object({ timezone: z.string().max(60).default("UTC") }).parse(args);
    return JSON.stringify({ timezone, now: new Date().toLocaleString("en-GB", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }), iso_utc: new Date().toISOString() });
  });
  return list;
}
