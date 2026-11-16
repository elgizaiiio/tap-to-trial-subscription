import { useState, type ReactNode } from "react";
import { Globe, ArrowUpRight } from "lucide-react";

export function ChatLink({ href, children }: { href?: string; children?: ReactNode }) {
  let url: URL;
  try { url = new URL(href || ""); } catch { return <>{children}</>; }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) return <>{children}</>;
  return <NamedLink key={url.hostname} url={url} label={children} />;
}

function NamedLink({ url, label }: { url: URL; label?: ReactNode }) {
  const plain = typeof label === "string" ? label : "";
  const named = plain && !/^https?:\/\//i.test(plain);
  const host = url.hostname.replace(/^www\./, "");
  let path = "";
  try { path = decodeURIComponent(url.pathname.split("/").filter(Boolean).pop() || "").replace(/[-_]/g, " ").replace(/\.[a-z]{2,5}$/i, ""); } catch { /* use site name */ }
  const title = named ? plain : path ? `${path} · ${host}` : host;
  const [iconFailed, setIconFailed] = useState(false);
  // Never fetch arbitrary linked pages: avoids private-network requests and
  // repeated HTML downloads while an answer streams. Use the model's title.
  return <a href={url.href} target="_blank" rel="noopener noreferrer" title={title} className="cx-named-link" data-source-link="">
    {iconFailed ? <Globe size={14} aria-hidden /> : <img src={siteIcon(url.hostname)} alt="" width={16} height={16} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={(e) => { const img = e.currentTarget; if (!img.dataset.fb) { img.dataset.fb = "1"; img.src = siteIconFallback(url.hostname); } else setIconFailed(true); }} />}
    <span dir="auto">{title}</span><ArrowUpRight size={12} aria-hidden />
  </a>;
}
/** Favicon source for any site. DuckDuckGo's icon service is not blocked by privacy browsers (Brave shields block Google's). */
export function siteIcon(host: string, _size = 64) {
  return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host.replace(/^www\./, ""))}.ico`;
}
/** Second favicon source used when the first fails. */
export function siteIconFallback(host: string, size = 64) {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=${size}`;
}
