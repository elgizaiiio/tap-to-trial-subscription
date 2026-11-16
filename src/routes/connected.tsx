import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/** Landing page for the app-connection window: tells the opener and closes itself. */
export const Route = createFileRoute("/connected")({
  ssr: false,
  component: Connected,
  head: () => ({
    meta: [
      { title: "Account connected — Ceyo" },
      { name: "description", content: "Your app account is connected to Ceyo. You can return to your chat." },
      { property: "og:title", content: "Account connected — Ceyo" },
      { property: "og:description", content: "Your app account is connected to Ceyo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Connected() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const bad = /fail|error|denied/i.test(`${q.get("status") || ""}${q.get("error") || ""}`);
    setFailed(bad);
    try { window.opener?.postMessage({ type: "ceyo-connected", app: q.get("app"), ok: !bad }, window.location.origin); } catch { /* opener gone */ }
    if (!bad) window.setTimeout(() => window.close(), 900);
  }, []);
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6 text-center text-foreground">
      <div>
        <h1 className="text-xl font-semibold">{failed ? "الربط ما كملش" : "تم الربط ✓"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{failed ? "ارجع للتطبيق وجرب تاني." : "ارجع للمحادثة، الوكيل هيكمل لوحده."}</p>
      </div>
    </main>
  );
}
