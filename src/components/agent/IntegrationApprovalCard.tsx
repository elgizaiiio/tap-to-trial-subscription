import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IntegrationLogo } from "@/components/chat/integrations/IntegrationRow";
import { integrations, type Integration } from "@/lib/integrationsData";
import { integrationApproval, integrationApprovalStatus } from "@/lib/ceyo/integrations.functions";

const human = (slug: string, app: string) => slug.replace(new RegExp(`^${app}_`, "i"), "").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
const findApp = (app: string): Integration => {
  const key = app.toLowerCase().replace(/[\s_-]+/g, "");
  return integrations.find((i) => [i.id, i.app, i.name].some((v) => (v || "").toLowerCase().replace(/[\s_-]+/g, "") === key)) || ({ id: key, app: key, name: app, domain: `${key}.com`, description: "" } as unknown as Integration);
};

/** Clean approval for a connected-app action: app icon, plain description, Allow / Always allow / Decline. */
export function IntegrationApprovalCard({ data, onDone, onApproved, ar = false }: { data: Record<string, any>; onDone: () => void; onApproved?: (summary: string) => void; ar?: boolean }) {
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState("");
  const approve = useServerFn(integrationApproval);
  const read = useServerFn(integrationApprovalStatus);
  useEffect(() => { void read({ data: { id: String(data.id) } }).then((r) => setStatus(r.status)).catch(() => {}); }, [data.id, read]);
  const item = findApp(String(data.app || "app"));
  const action = human(String(data.action || ""), item.app);
  const description = typeof data.description === "string" ? data.description : action;
  const decide = async (approved: boolean, always = false) => {
    setStatus("running"); setError("");
    try {
      const result = await approve({ data: { id: String(data.id), approved, always } });
      setStatus(result.status); onDone();
      if (approved && result.status === "completed") onApproved?.(ar ? `وافقت على "${action}" في ${item.name} واتنفذت. كمّل الشغل من الخطوة اللي وقفت عندها بالظبط، من غير ما تعيد اللي خلص.` : `I approved "${action}" on ${item.name} and it ran. Continue from the exact step you stopped at without redoing finished steps.`);
    } catch { setStatus("failed"); setError(ar ? "التنفيذ ما كملش؛ راجع النتيجة قبل المحاولة تاني." : "The action did not finish. Check its result before trying again."); }
  };
  if (status === "completed" || status === "rejected") return (
    <div className="cx-card apcard-compact" dir="auto" aria-label={status === "completed" ? (ar ? "تمت الموافقة" : "Approved") : (ar ? "مرفوض" : "Declined")}>
      <span className="cx-app-logo"><IntegrationLogo item={item} size={24} /></span><b>{item.name}</b>
    </div>
  );
  return (
    <div className="cx-card apcard" dir="auto">
      <div className="cx-app-row">
        <span className="cx-app-logo"><IntegrationLogo item={item} size={36} /></span>
        <span className="cx-app-text"><b>{item.name}</b><small>{ar ? "محتاج موافقتك" : "Needs your approval"}</small></span>
      </div>
      <p className="apcard-action">{description}</p>
      {status === "pending" ? (
        <div className="apcard-actions">
          <Button size="sm" onClick={() => void decide(true)}><Check />{ar ? "موافق" : "Allow"}</Button>
          <Button size="sm" variant="secondary" onClick={() => void decide(true, true)}>{ar ? `موافق دايماً لـ ${item.name}` : `Always allow ${item.name}`}</Button>
          <Button size="sm" variant="ghost" onClick={() => void decide(false)}><X />{ar ? "لأ" : "Decline"}</Button>
        </div>
      ) : (
        <p className="apcard-status" role="status" data-status={status}>
          {status === "running" ? <><Loader2 size={14} className="animate-spin" />{ar ? "بينفّذ…" : "Working…"}</> : status === "completed" ? <><Check size={14} />{ar ? "اتنفذت" : "Done"}</> : status === "rejected" ? (ar ? "اترفضت" : "Declined") : (ar ? "ما نجحتش" : "Failed")}
        </p>
      )}
      {error && <p className="text-destructive text-sm mt-2">{error}</p>}
    </div>
  );
}
