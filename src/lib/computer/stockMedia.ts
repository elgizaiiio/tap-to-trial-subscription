import { z } from "zod";

export const STOCK_SOURCES = ["all", "pexels", "pixabay", "wikimedia", "openverse", "nasa", "archive"] as const;
const input = z.object({
  query: z.string().trim().min(2).max(160),
  kind: z.enum(["image", "video"]).default("video"),
  source: z.enum(STOCK_SOURCES).default("all"),
  orientation: z.enum(["any", "vertical", "horizontal", "square"]).default("any"),
  limit: z.number().int().min(1).max(12).default(6),
});
type Input = z.infer<typeof input>;
export type StockResult = { provider: string; title: string; source: string; page: string; mime: string; width?: number; height?: number; duration?: number; preview?: string; author: string; license: string; license_url: string; attribution: string };

const UA = { "User-Agent": "CeyoMedia/2.0 (https://ceyo.si)" };
const https = (u: unknown) => typeof u === "string" && u.startsWith("https://") ? u : "";
const plain = (text = "") => text.replace(/<[^>]*>/g, "").slice(0, 400);
const get = async (url: string, headers: Record<string, string> = {}) => {
  const r = await fetch(url, { headers: { ...UA, ...headers }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return r.json() as Promise<any>;
};
const fits = (o: Input["orientation"], w?: number, h?: number) => o === "any" || !w || !h || (o === "vertical" ? h > w : o === "horizontal" ? w > h : Math.abs(w - h) / w < 0.1);

async function pexels(a: Input, key: string): Promise<StockResult[]> {
  const o = a.orientation === "vertical" ? "portrait" : a.orientation === "horizontal" ? "landscape" : a.orientation === "square" ? "square" : "";
  const q = new URLSearchParams({ query: a.query, per_page: String(a.limit), ...(o ? { orientation: o } : {}) });
  if (a.kind === "video") {
    const d = await get(`https://api.pexels.com/videos/search?${q}`, { Authorization: key });
    return (d.videos ?? []).map((v: any) => {
      const files = (v.video_files ?? []).filter((f: any) => f.file_type === "video/mp4" && https(f.link)).sort((x: any, y: any) => Math.abs((x.height ?? 0) - 1080) - Math.abs((y.height ?? 0) - 1080));
      const f = files[0];
      return f && { provider: "Pexels", title: v.url?.split("/").filter(Boolean).pop() ?? "Pexels video", source: f.link, page: https(v.url), mime: "video/mp4", width: f.width, height: f.height, duration: v.duration, preview: https(v.image), author: v.user?.name ?? "", license: "Pexels License", license_url: "https://www.pexels.com/license/", attribution: `Video by ${v.user?.name ?? "creator"} on Pexels` };
    }).filter(Boolean);
  }
  const d = await get(`https://api.pexels.com/v1/search?${q}`, { Authorization: key });
  return (d.photos ?? []).map((p: any) => ({ provider: "Pexels", title: p.alt || "Pexels photo", source: https(p.src?.original), page: https(p.url), mime: "image/jpeg", width: p.width, height: p.height, preview: https(p.src?.medium), author: p.photographer ?? "", license: "Pexels License", license_url: "https://www.pexels.com/license/", attribution: `Photo by ${p.photographer} on Pexels` }));
}

async function pixabay(a: Input, key: string): Promise<StockResult[]> {
  const q = new URLSearchParams({ key, q: a.query.slice(0, 100), per_page: String(Math.max(3, a.limit)), safesearch: "true", ...(a.kind === "image" && a.orientation !== "any" && a.orientation !== "square" ? { orientation: a.orientation } : {}) });
  if (a.kind === "video") {
    const d = await get(`https://pixabay.com/api/videos/?${q}`);
    return (d.hits ?? []).map((v: any) => { const f = v.videos?.large?.url ? v.videos.large : v.videos?.medium; return { provider: "Pixabay", title: v.tags, source: https(f?.url), page: https(v.pageURL), mime: "video/mp4", width: f?.width, height: f?.height, duration: v.duration, preview: https(f?.thumbnail), author: v.user ?? "", license: "Pixabay Content License", license_url: "https://pixabay.com/service/license-summary/", attribution: `Video by ${v.user} on Pixabay` }; });
  }
  const d = await get(`https://pixabay.com/api/?${q}`);
  return (d.hits ?? []).map((p: any) => ({ provider: "Pixabay", title: p.tags, source: https(p.largeImageURL), page: https(p.pageURL), mime: "image/jpeg", width: p.imageWidth, height: p.imageHeight, preview: https(p.webformatURL), author: p.user ?? "", license: "Pixabay Content License", license_url: "https://pixabay.com/service/license-summary/", attribution: `Image by ${p.user} on Pixabay` }));
}

async function wikimedia(a: Input): Promise<StockResult[]> {
  const q = new URLSearchParams({ action: "query", format: "json", generator: "search", gsrsearch: `${a.query} filetype:${a.kind === "video" ? "video" : "bitmap"}`, gsrnamespace: "6", gsrlimit: String(a.limit + 2), prop: "imageinfo", iiprop: "url|mime|size|extmetadata", iiurlwidth: "480", origin: "*" });
  const d = await get(`https://commons.wikimedia.org/w/api.php?${q}`);
  return Object.values<any>(d.query?.pages ?? {}).flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info || !String(info.mime).startsWith(a.kind === "video" ? "video/" : "image/")) return [];
    return [{ provider: "Wikimedia Commons", title: page.title, source: https(info.url), page: https(info.descriptionurl), mime: info.mime, width: info.width, height: info.height, duration: info.duration, preview: https(info.thumburl), author: plain(info.extmetadata?.Artist?.value), license: plain(info.extmetadata?.LicenseShortName?.value), license_url: https(info.extmetadata?.LicenseUrl?.value), attribution: plain(info.extmetadata?.Attribution?.value) }];
  });
}

async function openverse(a: Input): Promise<StockResult[]> {
  if (a.kind === "video") return [];
  const q = new URLSearchParams({ q: a.query, page_size: String(a.limit), license_type: "commercial", mature: "false", ...(a.orientation === "vertical" ? { aspect_ratio: "tall" } : a.orientation === "horizontal" ? { aspect_ratio: "wide" } : a.orientation === "square" ? { aspect_ratio: "square" } : {}) });
  const d = await get(`https://api.openverse.org/v1/images/?${q}`);
  return (d.results ?? []).map((r: any) => ({ provider: `Openverse (${r.source})`, title: r.title ?? "", source: https(r.url), page: https(r.foreign_landing_url), mime: "image/" + (r.filetype || "jpeg"), width: r.width, height: r.height, preview: https(r.thumbnail), author: r.creator ?? "", license: `${String(r.license).toUpperCase()} ${r.license_version ?? ""}`.trim(), license_url: https(r.license_url), attribution: plain(r.attribution) }));
}

async function nasa(a: Input): Promise<StockResult[]> {
  const d = await get(`https://images-api.nasa.gov/search?${new URLSearchParams({ q: a.query, media_type: a.kind, page_size: String(a.limit) })}`);
  const items = (d.collection?.items ?? []).slice(0, a.limit);
  const out = await Promise.all(items.map(async (it: any) => {
    const meta = it.data?.[0] ?? {};
    const files: string[] = await get(String(it.href).replace(/^http:/, "https:")).catch(() => []);
    const pick = a.kind === "video" ? files.find((f) => /~(orig|large|medium)\.mp4$/.test(f)) ?? files.find((f) => f.endsWith(".mp4")) : files.find((f) => /~(large|orig)\.jpg$/.test(f)) ?? files.find((f) => f.endsWith(".jpg"));
    if (!pick) return null;
    return { provider: "NASA Image and Video Library", title: meta.title ?? "", source: pick.replace(/^http:/, "https:").replace(/ /g, "%20"), page: `https://images.nasa.gov/details/${encodeURIComponent(meta.nasa_id ?? "")}`, mime: a.kind === "video" ? "video/mp4" : "image/jpeg", preview: https(it.links?.[0]?.href), author: meta.photographer || meta.center || "NASA", license: "NASA media guidelines (generally not copyrighted)", license_url: "https://www.nasa.gov/nasa-brand-center/images-and-media/", attribution: `Courtesy NASA${meta.center ? ` / ${meta.center}` : ""}` };
  }));
  return out.filter(Boolean) as StockResult[];
}

async function archive(a: Input): Promise<StockResult[]> {
  if (a.kind === "image") return [];
  // Public-domain / CC film collections (Prelinger, feature films) for cinematic and historical footage.
  const q = new URLSearchParams({ q: `(${a.query}) AND mediatype:movies AND (licenseurl:*publicdomain* OR licenseurl:*creativecommons* OR collection:prelinger)`, "fl[]": "identifier", rows: String(a.limit), output: "json" });
  const d = await get(`https://archive.org/advancedsearch.php?${q.toString().replace(/fl%5B%5D/g, "fl[]")}`);
  const ids: string[] = (d.response?.docs ?? []).map((x: any) => x.identifier).filter((x: unknown) => typeof x === "string" && /^[\w.-]+$/.test(x as string));
  const out = await Promise.all(ids.map(async (id) => {
    const m = await get(`https://archive.org/metadata/${id}`).catch(() => null);
    const file = (m?.files ?? []).filter((f: any) => /\.mp4$/i.test(f.name) && Number(f.size) < 150e6).sort((x: any, y: any) => Number(x.size) - Number(y.size)).pop();
    if (!file) return null;
    return { provider: "Internet Archive", title: m.metadata?.title ?? id, source: `https://archive.org/download/${id}/${encodeURIComponent(file.name)}`, page: `https://archive.org/details/${id}`, mime: "video/mp4", width: Number(file.width) || undefined, height: Number(file.height) || undefined, duration: Number(file.length) || undefined, preview: `https://archive.org/services/img/${id}`, author: plain(String(m.metadata?.creator ?? "")), license: m.metadata?.licenseurl ? "See license URL" : "Public domain (Prelinger/collection terms)", license_url: https(m.metadata?.licenseurl), attribution: `${m.metadata?.title ?? id} — Internet Archive` };
  }));
  return out.filter(Boolean) as StockResult[];
}

/** Searches several real libraries in parallel; keyed libraries are used only when the owner has added their key. */
export async function searchStockMedia(raw: unknown, keys: (name: "pexels" | "pixabay") => Promise<string | null> = async () => null) {
  const a = input.parse(raw);
  const want = (s: (typeof STOCK_SOURCES)[number]) => a.source === "all" || a.source === s;
  const [pk, xk] = await Promise.all([want("pexels") ? keys("pexels") : null, want("pixabay") ? keys("pixabay") : null]);
  const jobs: [string, Promise<StockResult[]>][] = [];
  if (pk) jobs.push(["pexels", pexels(a, pk)]);
  if (xk) jobs.push(["pixabay", pixabay(a, xk)]);
  if (want("wikimedia")) jobs.push(["wikimedia", wikimedia(a)]);
  if (want("openverse")) jobs.push(["openverse", openverse(a)]);
  if (want("nasa")) jobs.push(["nasa", nasa(a)]);
  if (want("archive")) jobs.push(["archive", archive(a)]);
  const settled = await Promise.allSettled(jobs.map(([, p]) => p));
  const unavailable = [...(want("pexels") && !pk ? ["pexels (no key added)"] : []), ...(want("pixabay") && !xk ? ["pixabay (no key added)"] : []), ...settled.flatMap((s, i) => s.status === "rejected" ? [jobs[i][0]] : [])];
  const results = settled.flatMap((s) => s.status === "fulfilled" ? s.value : []).filter((r) => r.source && fits(a.orientation, r.width, r.height)).slice(0, 24);
  if (!results.length && settled.every((s) => s.status === "rejected")) throw new Error("Stock media search unavailable; try web_search for licensed assets.");
  return JSON.stringify({ results, unavailable, instruction: "Pick clips matching the story and orientation, then analyze_media each before trimming. Respect each license; list provider/author/license in the final reply. No results is not permission to invent footage." });
}
