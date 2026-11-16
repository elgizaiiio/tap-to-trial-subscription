import { useEffect, useState } from "react";
import { Check, ExternalLink, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Live browser window for sign-ins and human checks; "I'm done" resumes the bot's task. */
export function BrowserHandoffCard({ id, data, onDone }: { id: string; data: Record<string, unknown>; onDone: (message: string) => void }) {
  const url = typeof data.url === "string" && /^https:\/\//.test(data.url) ? data.url : "";
  const site = typeof data.site === "string" ? data.site.replace(/^https?:\/\//, "").split("/")[0] : "";
  const key = `ceyo_handoff_done:${id}`;
  const [done, setDone] = useState(false);
  useEffect(() => { try { setDone(localStorage.getItem(key) === "1"); } catch { /* storage unavailable */ } }, [key]);
  const finish = () => {
    setDone(true);
    try { localStorage.setItem(key, "1"); } catch { /* storage unavailable */ }
    onDone(`I finished in the browser${site ? ` on ${site}` : ""} (signed in / passed the check). Look at the page to confirm, then continue the task from the exact step you stopped at.`);
  };
  return (
    <div className="cx-card" aria-label="Browser needs you">
      <div className="cx-app-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span className="cx-app-icon"><Globe size={20} /></span>
        <span className="cx-app-text"><b>{site || "Browser"}</b><small>{done ? "Thanks — your bot is continuing" : "Sign in or complete the check, then tap I'm done"}</small></span>
      </div>
      {url && !done && (
        <iframe title="Live browser" src={url} sandbox="allow-same-origin allow-scripts allow-forms allow-popups" allow="clipboard-read; clipboard-write" style={{ width: "100%", aspectRatio: "16 / 10", border: 0, borderRadius: 12, marginTop: 10, background: "var(--background)" }} />
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        {done ? (
          <span className="cx-app-done"><Check size={15} />Done</span>
        ) : (
          <>
            <Button size="sm" onClick={finish}><Check />I'm done</Button>
            {url && <Button size="sm" variant="secondary" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink />Open full screen</a></Button>}
          </>
        )}
      </div>
    </div>
  );
}
