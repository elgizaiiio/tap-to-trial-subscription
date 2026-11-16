import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
export const Route = createFileRoute("/api/ceyo-task")({ server: { handlers: {
  POST: async ({ request }) => {
    const { authenticate } = await import("@/lib/ceyo/auth.server");
    const auth = await authenticate(request).catch(() => null);
    if (!auth) return Response.json({ error: "unauthorized" }, { status: 401 });
    const parsed = z.object({ jobId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Invalid job" }, { status: 400 });
    const { data: job } = await auth.db.from("agent_jobs").select("id,status,conversation_id,goal,bot_id,updated_at").eq("id", parsed.data.jobId).eq("user_id", auth.userId).maybeSingle();
    if (!job) return Response.json({ error: "Not found" }, { status: 404 });
    const { isStalledJob, stalledJobNote } = await import("@/lib/ceyo/jobHealth");
    if (isStalledJob(job)) {
      // Ownership was verified above; the worker is gone, so close the task and tell the user once.
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: closed } = await supabaseAdmin.from("agent_jobs").update({ status: "failed", error: "Task interrupted. Review any delivered result before starting it again." }).eq("id", job.id).in("status", ["queued", "running"]).select("id").maybeSingle();
      if (closed) {
        const { error } = await supabaseAdmin.from("messages").upsert({ id: job.id, user_id: auth.userId, conversation_id: job.conversation_id, bot_id: job.bot_id, role: "assistant", content: stalledJobNote(job.goal), metadata: { fromJob: job.id, incomplete: true } }, { onConflict: "id", ignoreDuplicates: true });
        if (error) console.error("Stopped task note could not be saved");
      }
      return Response.json({ done: true, status: "failed", conversationId: job.conversation_id }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json({ done: ["completed", "failed", "cancelled"].includes(job.status), status: job.status, conversationId: job.conversation_id }, { headers: { "Cache-Control": "no-store" } });
  },
} } });