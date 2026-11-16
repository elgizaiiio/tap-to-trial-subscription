import { createFileRoute } from "@tanstack/react-router";

async function receive(request: Request) {
  const [{ handleXWebhook }, { channelCredential }] = await Promise.all([
    import("@/lib/channels/xWebhook.server"), import("@/lib/channels/credentials.server"),
  ]);
  return handleXWebhook(request, channelCredential);
}

export const Route = createFileRoute("/api/public/channels/xchat")({
  server: { handlers: {
    GET: ({ request }) => receive(request),
    POST: ({ request }) => receive(request),
  } },
});