import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/channels/x-poll")({ server: { handlers: { POST: async ({ request }) => {
  const { schedulerSecret } = await import("@/lib/ceyo/runtimeCredentials.server");
  const secret = await schedulerSecret().catch(() => null);
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { pollXMessages } = await import("@/lib/channels/xPoll.server");
  return Response.json(await pollXMessages().catch(() => ({ error: true })));
} } } });
