import { createFileRoute } from "@tanstack/react-router";
import { equalSecret, webhookSecret } from "@/lib/channels/security";

export const Route = createFileRoute("/api/public/channels/telegram")({ server: { handlers: {
  POST: async ({ request }) => {
    const { channelCredential } = await import("@/lib/channels/credentials.server");
    const token = await channelCredential("CEYO_TELEGRAM_CHANNEL_TOKEN").catch(() => null);
    if (!token) return new Response("Channel unavailable", { status: 503 });
    if (!equalSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token") || "", await webhookSecret(token))) return new Response("Unauthorized", { status: 401 });
    const body = await request.text();
    if (body.length > 100000) return new Response("Update too large", { status: 413 });
    let update: unknown;
    try { update = JSON.parse(body); } catch { return new Response("Invalid update", { status: 400 }); }
    const { receiveTelegram } = await import("@/lib/channels/telegram.server");
    return receiveTelegram(update, token, new URL(request.url).origin);
  },
} } });