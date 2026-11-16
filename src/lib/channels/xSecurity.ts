import { z } from "zod";

export const xChallenge = z.string().min(1).max(512);
export const xActivity = z.object({
  data: z.object({
    event_type: z.string().min(1).max(80),
    event_uuid: z.string().min(1).max(128),
    payload: z.object({
      encoded_event: z.string().min(1).max(90000),
      conversation_key_change_event: z.string().max(90000).optional(),
    }),
  }),
});

function bytes(value: string) { return new TextEncoder().encode(value); }
function fromBase64(value: string) {
  try { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
  catch { return null; }
}
async function hmacKey(secret: string, usage: KeyUsage) {
  return crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

/** Only return provider-required CRC responses to X; never log them. */
export async function xCrcResponse(secret: string, challenge: string) {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret, "sign"), bytes(xChallenge.parse(challenge)));
  return `sha256=${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

export async function verifyXSignature(secret: string, signature: string | null, body: string) {
  if (!signature || !/^sha256=[A-Za-z0-9+/]{43}=$/.test(signature)) return false;
  const decoded = fromBase64(signature.slice(7));
  if (!decoded) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret, "verify"), decoded, bytes(body));
}