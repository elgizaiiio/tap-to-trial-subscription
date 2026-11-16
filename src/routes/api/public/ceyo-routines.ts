import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/ceyo-routines")({ server: { handlers: { POST: async ({ request }) => {
  const { schedulerSecret } = await import("@/lib/ceyo/runtimeCredentials.server");
  const secret = await schedulerSecret().catch(() => null);
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const { runDueRoutines } = await import("@/lib/ceyo/routines.server");
  const { runStaleJobs } = await import("@/lib/ceyo/backgroundJobs.server");
  const { syncPhoneCalls } = await import("@/lib/phone/telnyx.server");
  const { pollXMessages } = await import("@/lib/channels/xPoll.server");
  const [results, jobs, phone, x] = await Promise.all([runDueRoutines(), runStaleJobs(), syncPhoneCalls().catch(() => []), pollXMessages().catch(() => ({ error: true }))]);
  return Response.json({ results, jobs, phone, x });
} } } });