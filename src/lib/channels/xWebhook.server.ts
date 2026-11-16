import { xActivity, xChallenge, xCrcResponse, verifyXSignature } from "./xSecurity";

type CredentialReader = (name: string) => Promise<string | null>;

/** Ciphertext is never treated as plaintext, nor acknowledged before durable processing exists. */
export async function handleXWebhook(request: Request, readCredential: CredentialReader): Promise<Response> {
  const noStore = { "Cache-Control": "no-store" };
  const secret = await readCredential("CEYO_XCHAT_CONSUMER_SECRET").catch(() => null);
  if (!secret) return new Response("Channel unavailable", { status: 503, headers: noStore });
  if (request.method === "GET") {
    const challenge = xChallenge.safeParse(new URL(request.url).searchParams.get("crc_token"));
    if (!challenge.success) return new Response("Invalid challenge", { status: 400, headers: noStore });
    return Response.json({ response_token: await xCrcResponse(secret, challenge.data) }, { headers: noStore });
  }
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > 100000) return new Response("Update too large", { status: 413, headers: noStore });
  if (!await verifyXSignature(secret, request.headers.get("x-twitter-webhooks-signature"), body)) {
    return new Response("Unauthorized", { status: 401, headers: noStore });
  }
  let raw: unknown;
  try { raw = JSON.parse(body); } catch { return new Response("Invalid update", { status: 400, headers: noStore }); }
  if (!xActivity.safeParse(raw).success) return new Response("Unsupported update", { status: 400, headers: noStore });
  // A 200 here would silently lose the message. Keep registration disabled until
  // the official crypto adapter and persistent execution service are operational.
  return new Response("Encrypted messaging transport is not active", { status: 503, headers: noStore });
}