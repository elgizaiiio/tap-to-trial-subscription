import { z } from "zod";

/** Hosted Telegram bots: config lives in the owner's agent_documents row; the bot token is never stored. */
export const HOSTED_BOT_MIME = "application/vnd.ceyo.telegram-bot+json";
export const HOOK_PATH = "/api/public/tg-bot/";

export const hostedBotConfig = z.object({
  v: z.literal(1),
  bot_id: z.number().int(),
  username: z.string().max(64),
  mode: z.enum(["auto_reply", "ai_chat"]),
  start_text: z.string().min(1).max(4000),
  commands: z.array(z.object({ command: z.string().regex(/^[a-z0-9_]{1,32}$/), description: z.string().min(1).max(256), reply: z.string().max(4000).optional() })).max(30).default([]),
  default_reply: z.string().max(4000).optional(),
  persona: z.string().max(4000).optional(),
  /** Answer people in the owner's personal chats (Telegram Business). Off unless the owner asked. */
  business_reply: z.boolean().default(false),
});
export type HostedBotConfig = z.infer<typeof hostedBotConfig>;

/** Telegram's secret_token: unguessable per hosted bot, verified on every webhook call. */
export async function hostedBotSecret(secret: string, docId: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`telegram-bot:${docId}`)));
  return Array.from(mac, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Telegram must reach a public host: preview hosts sit behind sign-in, so use the public dev host. */
export function publicHookOrigin(origin: string, fallback?: string) {
  const u = new URL(origin);
  const preview = u.hostname.match(/^id-preview--([0-9a-f-]+)\.(.+)$/);
  if (preview) return `https://project--${preview[1]}-dev.${preview[2]}`;
  if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
    if (!fallback) throw new Error("No public address is available for the bot webhook");
    return new URL(fallback).origin;
  }
  return u.origin;
}

export function commandOf(text: string) {
  const m = text.trim().match(/^\/([A-Za-z0-9_]{1,32})(?:@\w+)?(?:\s|$)/);
  return m ? m[1].toLowerCase() : null;
}

/** Private chats always get an answer; in groups only commands or @mentions. */
export function shouldAnswer(cfg: HostedBotConfig, chatType: string | undefined, text: string) {
  if (chatType === "private") return true;
  return commandOf(text) !== null || text.toLowerCase().includes(`@${cfg.username.toLowerCase()}`);
}

/** Fixed reply for /start, known commands and (auto_reply mode) everything else; null means "ask the AI" or stay quiet. */
export function fixedReply(cfg: HostedBotConfig, text: string): string | null {
  const cmd = commandOf(text);
  if (cmd === "start") return cfg.start_text;
  const known = cmd ? cfg.commands.find((c) => c.command === cmd) : undefined;
  if (known?.reply) return known.reply;
  if (cfg.mode === "auto_reply") return cfg.default_reply || null;
  return null;
}

/** Every update type a hosted bot listens to, including the owner's personal chats via Telegram Business. */
export const HOSTED_UPDATES = ["message", "edited_message", "channel_post", "edited_channel_post", "business_connection", "business_message", "edited_business_message"];
