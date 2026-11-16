import { z } from "zod";

export const pairingInput = z.object({ platform: z.literal("telegram"), botId: z.string().uuid() });
export const telegramUpdate = z.object({
  update_id: z.number().int().nonnegative(),
  message: z.object({
    message_id: z.number().int(),
    from: z.object({ id: z.number().int().positive(), is_bot: z.boolean().optional() }),
    chat: z.object({ id: z.number().int(), type: z.string().max(32) }),
    text: z.string().max(10000).optional(),
  }).optional(),
});
export async function pairingHash(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("");
}
export async function webhookSecret(token: string) { return pairingHash(`ceyo-official-channel:${token}`); }
export function equalSecret(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
export function privateSender(message: NonNullable<z.infer<typeof telegramUpdate>["message"]>) {
  return message.chat.type === "private" && message.chat.id === message.from.id && !message.from.is_bot;
}
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
/** Short code shown to the user only when they ask; valid for one minute. */
export function newShortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const raw = Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}
export function shortCode(text: string) {
  const m = text.trim().match(/^(?:\/start(?:@\w+)?\s+)?([A-Za-z0-9]{4})[- ]?([A-Za-z0-9]{4})$/);
  return m ? `${m[1]}-${m[2]}`.toUpperCase() : null;
}
export function pairingCode(text: string) { return text.match(/^\/start(?:@\w+)?\s+([a-f0-9]{64})$/i)?.[1] ?? null; }