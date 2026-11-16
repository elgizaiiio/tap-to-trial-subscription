import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SITE_MIME = "text/html; ceyo-site";

// Serves a web page the agent published for its owner. The CSP sandbox gives the page an opaque origin,
// so its scripts can never read this app's cookies, storage or session.
export const Route = createFileRoute("/api/public/site/$siteId")({ server: { handlers: { GET: async ({ params }) => {
  if (!z.string().uuid().safeParse(params.siteId).success) return new Response("Not found", { status: 404 });
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db.from("agent_documents").select("content").eq("id", params.siteId).eq("mime", SITE_MIME).maybeSingle();
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(data.content, { headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "public, max-age=60",
  } });
} } } });
