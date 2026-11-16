import { useState } from "react";
import { z } from "zod";
import { BadgeCheck, Bookmark, Eye, Heart, MessageCircle, MoreHorizontal, Play, Repeat2, Send, Share2, ThumbsUp, ThumbsDown, BarChart3, Music2, Share, ArrowBigUp, ArrowBigDown } from "lucide-react";
import { SiInstagram, SiYoutube, SiTiktok, SiX, SiFacebook, SiReddit } from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
import { socialItemSchema, type SocialItem } from "@/lib/ceyo/socialResults";

const dataSchema = z.object({ items: z.array(socialItemSchema).max(20) });
const logos: Record<SocialItem["platform"], typeof SiX | null> = { instagram: SiInstagram, youtube: SiYoutube, tiktok: SiTiktok, x: SiX, facebook: SiFacebook, linkedin: FaLinkedin, reddit: SiReddit, social: null };

/** Social CDNs (Instagram/Facebook/TikTok) block hotlinked images; route them through a public image proxy. */
const proxied = (src?: string) => src && /cdninstagram|fbcdn|tiktokcdn|twimg|ytimg|ggpht/.test(src) ? `https://images.weserv.nl/?url=${encodeURIComponent(src)}&n=-1` : src;

function Img({ src, className, alt = "" }: { src?: string; className: string; alt?: string }) {
  const [step, setStep] = useState(0);
  const url = step === 0 ? proxied(src) : step === 1 ? src : undefined;
  if (!url) return <div className={`${className} bg-muted`} />;
  return <img src={url} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setStep((s) => s + 1)} className={`${className} object-cover`} />;
}
function Media({ item, className }: { item: SocialItem; className: string }) {
  const [bad, setBad] = useState(false);
  if (item.video && !bad) return <video src={item.video} poster={proxied(item.image)} controls playsInline preload="none" onError={() => setBad(true)} onClick={(e) => e.preventDefault()} className={`${className} bg-foreground object-cover`} />;
  return <div className="relative"><Img src={item.image} className={className} />{item.kind !== "post" && <Play className="absolute start-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-background drop-shadow" size={44} fill="currentColor" />}</div>;
}
const Avatar = ({ item, size = "size-9", ring = false }: { item: SocialItem; size?: string; ring?: boolean }) =>
  <span className={ring ? "social-story-ring shrink-0 rounded-full p-[2px]" : "shrink-0"}><Img src={item.avatar || (item.kind === "account" ? item.image : undefined)} className={`${size} block rounded-full ${ring ? "border-2 border-card" : ""}`} /></span>;
const Name = ({ item, handle = false }: { item: SocialItem; handle?: boolean }) =>
  <span className="flex min-w-0 items-center gap-1 font-semibold"><span className="truncate" dir="auto">{handle ? item.handle || item.author : item.author || item.handle || item.title}</span>{item.verified && <BadgeCheck size={15} className="social-verified shrink-0" fill="currentColor" stroke="var(--card)" />}</span>;

function Caption({ item, prefix }: { item: SocialItem; prefix?: string }) {
  const [open, setOpen] = useState(false);
  if (!item.text) return null;
  const long = item.text.length > 125;
  return <p className="whitespace-pre-wrap break-words" dir="auto">{prefix && <span className="font-semibold">{prefix} </span>}{open || !long ? item.text : `${item.text.slice(0, 125)}… `}{long && !open && <button type="button" className="text-muted-foreground" onClick={(e) => { e.preventDefault(); setOpen(true); }}>more</button>}</p>;
}

export function SocialResultsCard({ data, ar }: { data: unknown; ar: boolean }) {
  const result = dataSchema.safeParse(data);
  if (!result.success || !result.data.items.length) return null;
  const n = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
  const full = new Intl.NumberFormat("en");
  const f = (v?: number) => v === undefined ? "" : n.format(v);
  const ago = (d?: string) => {
    const t = Date.parse(d || ""); if (!Number.isFinite(t)) return "";
    const s = (Date.now() - t) / 1000;
    if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`; if (s < 86400) return `${Math.round(s / 3600)}h`; if (s < 604800) return `${Math.round(s / 86400)}d`;
    return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", ...(s > 31536000 ? { year: "numeric" } : {}) }).format(t);
  };
  const dur = (s?: number) => s === undefined ? "" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const card = (item: SocialItem) => {
    if (item.kind === "account") return <div className="p-4">
      <div className="flex items-center gap-5"><Avatar item={item} size="size-20" ring={item.platform === "instagram"} />
        <div className="min-w-0 flex-1"><div className="mb-2 text-base"><Name item={item} handle /></div>
          <div className="grid grid-cols-3 text-sm">
            {[[item.posts, "posts"], [item.followers, "followers"], [item.following, "following"]].map(([v, l]) => <div key={l as string}><div className="font-semibold">{f(v as number) || "—"}</div><div className="text-xs text-muted-foreground">{l}</div></div>)}
          </div></div></div>
      <div className="mt-3 text-sm">{item.author && <div className="font-semibold" dir="auto">{item.author}</div>}<Caption item={item} /></div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-semibold"><span className="social-follow rounded-lg py-1.5 text-center">Follow</span><span className="rounded-lg bg-muted py-1.5 text-center">Message</span></div>
    </div>;
    switch (item.platform) {
      case "x": return <div className="flex gap-3 p-4"><Avatar item={item} size="size-10" />
        <div className="min-w-0 flex-1 text-[15px]">
          <div className="flex items-center gap-1"><Name item={item} />{item.handle && <span className="truncate text-muted-foreground" dir="ltr">@{item.handle}</span>}{ago(item.date) && <span className="shrink-0 text-muted-foreground">· {ago(item.date)}</span>}<MoreHorizontal size={16} className="ms-auto shrink-0 text-muted-foreground" /></div>
          <div className="mt-0.5"><Caption item={item} /></div>
          {(item.image || item.video) && <div className="mt-3 overflow-hidden rounded-2xl border border-border"><Media item={item} className="aspect-video w-full" /></div>}
          <div className="mt-3 flex justify-between text-muted-foreground">
            {[[MessageCircle, item.comments], [Repeat2, item.shares], [Heart, item.likes], [BarChart3, item.views], [Bookmark, undefined]].map(([I, v], i) => { const Icon = I as typeof Heart; return <span key={i} className="flex items-center gap-1 text-[13px]"><Icon size={17} />{f(v as number)}</span>; })}
          </div></div></div>;
      case "youtube": return <div>
        <div className="relative"><Media item={item} className="aspect-video w-full" />{dur(item.duration) && <span className="absolute bottom-2 end-2 rounded bg-foreground/80 px-1.5 text-xs font-medium text-background">{dur(item.duration)}</span>}</div>
        <div className="flex gap-3 p-3"><Avatar item={item} />
          <div className="min-w-0 flex-1 text-sm"><h3 className="line-clamp-2 font-semibold leading-snug" dir="auto">{item.title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground" dir="auto">{[item.author, item.views !== undefined && `${f(item.views)} views`, ago(item.date) && `${ago(item.date)} ago`].filter(Boolean).join(" • ")}</p>
            <div className="mt-2 flex gap-2 text-xs font-medium">
              <span className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5"><ThumbsUp size={15} />{f(item.likes)}<span className="h-4 w-px bg-border" /><ThumbsDown size={15} /></span>
              <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5"><Share size={15} />Share</span>
              {item.comments !== undefined && <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1.5"><MessageCircle size={15} />{f(item.comments)}</span>}
            </div></div><MoreHorizontal size={18} className="shrink-0 rotate-90 text-muted-foreground" /></div></div>;
      case "tiktok": return <div className="relative mx-auto aspect-[9/16] max-h-[560px] w-full overflow-hidden bg-foreground text-background">
        <Media item={item} className="absolute inset-0 size-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-foreground/80 via-transparent to-transparent" />
        <div className="absolute end-2 bottom-20 flex flex-col items-center gap-4 text-xs font-semibold">
          <Avatar item={item} size="size-11" />
          {[[Heart, item.likes], [MessageCircle, item.comments], [Bookmark, undefined], [Share2, item.shares]].map(([I, v], i) => { const Icon = I as typeof Heart; return <span key={i} className="flex flex-col items-center gap-1 drop-shadow"><Icon size={28} fill="currentColor" />{f(v as number)}</span>; })}
        </div>
        <div className="absolute bottom-3 start-3 end-16 space-y-1 text-sm drop-shadow"><div className="font-semibold" dir="ltr">{item.handle || item.author}{item.verified && <BadgeCheck size={14} className="social-verified ms-1 inline" fill="currentColor" />}</div><div className="line-clamp-2"><Caption item={item} /></div>
          <div className="flex items-center gap-3 text-xs"><span className="flex items-center gap-1"><Music2 size={13} />original sound</span>{item.views !== undefined && <span className="flex items-center gap-1"><Eye size={13} />{f(item.views)}</span>}</div></div>
      </div>;
      case "reddit": return <div className="p-3 text-sm">
        <div className="flex items-center gap-2 text-xs"><Avatar item={item} size="size-6" /><span className="font-semibold">{item.author ? `u/${item.author}` : ""}</span>{ago(item.date) && <span className="text-muted-foreground">• {ago(item.date)}</span>}</div>
        <h3 className="mt-2 text-base font-semibold" dir="auto">{item.title}</h3>
        <div className="mt-1 line-clamp-4 text-muted-foreground"><Caption item={item} /></div>
        {(item.image || item.video) && <div className="mt-2 overflow-hidden rounded-xl"><Media item={item} className="aspect-video w-full" /></div>}
        <div className="mt-3 flex gap-2 text-xs font-semibold"><span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1"><ArrowBigUp size={16} />{f(item.likes)}<ArrowBigDown size={16} /></span><span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1"><MessageCircle size={14} />{f(item.comments)}</span><span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1"><Share size={14} />Share</span></div>
      </div>;
      case "facebook": case "linkedin": return <div className="text-sm">
        <div className="flex items-center gap-2 p-3"><Avatar item={item} size="size-10" /><div className="min-w-0 flex-1"><Name item={item} /><div className="text-xs text-muted-foreground">{ago(item.date)} · 🌐</div></div><MoreHorizontal size={18} /></div>
        <div className="px-3 pb-2"><Caption item={item} /></div>
        {(item.image || item.video) && <Media item={item} className="aspect-[4/3] w-full" />}
        <div className="flex justify-between px-3 py-2 text-xs text-muted-foreground"><span>{item.likes !== undefined && `👍❤️ ${f(item.likes)}`}</span><span>{[item.comments !== undefined && `${f(item.comments)} comments`, item.shares !== undefined && `${f(item.shares)} shares`].filter(Boolean).join(" · ")}</span></div>
        <div className="mx-3 flex justify-around border-t border-border py-2 text-[13px] font-semibold text-muted-foreground"><span className="flex items-center gap-1.5"><ThumbsUp size={17} />Like</span><span className="flex items-center gap-1.5"><MessageCircle size={17} />Comment</span><span className="flex items-center gap-1.5"><Share size={17} />Share</span></div>
      </div>;
      default: return <div className="text-sm">
        <div className="flex items-center gap-2.5 px-3 py-2.5"><Avatar item={item} size="size-8" ring /><div className="min-w-0 flex-1"><Name item={item} handle /></div><span className="social-follow-text font-semibold">Follow</span><MoreHorizontal size={18} /></div>
        <Media item={item} className={item.kind === "reel" || item.kind === "video" ? "aspect-[4/5] w-full" : "aspect-square w-full"} />
        <div className="flex items-center gap-4 px-3 pt-3"><span className="flex items-center gap-1.5"><Heart size={24} />{f(item.likes)}</span><span className="flex items-center gap-1.5"><MessageCircle size={24} className="-scale-x-100" />{f(item.comments)}</span><span className="flex items-center gap-1.5"><Send size={22} />{f(item.shares)}</span><Bookmark size={23} className="ms-auto" /></div>
        <div className="space-y-1 px-3 pt-2 pb-3">
          {item.likes !== undefined && <div className="font-semibold">{full.format(item.likes)} likes</div>}
          {item.views !== undefined && <div className="text-muted-foreground">{full.format(item.views)} views</div>}
          <Caption item={item} prefix={item.handle || item.author} />
          {item.comments !== undefined && item.comments > 0 && <div className="text-muted-foreground">View all {full.format(item.comments)} comments</div>}
          {ago(item.date) && <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{ago(item.date)}</div>}
        </div></div>;
    }
  };

  return <div className="grid w-full max-w-md gap-3" dir="ltr" lang={ar ? "en" : undefined}>
    {result.data.items.map((item, i) => { const L = logos[item.platform]; return <a key={`${item.url}-${i}`} href={item.url} target="_blank" rel="noopener noreferrer" className="relative block overflow-hidden rounded-2xl border border-border bg-card text-card-foreground no-underline transition hover:border-foreground/30">
      {card(item)}
      {L && item.platform !== "tiktok" && <span className={`social-logo-${item.platform} absolute end-2 bottom-2 rounded-full bg-background/80 p-1 backdrop-blur`}><L size={13} /></span>}
      {L && item.platform === "tiktok" && <span className="absolute top-2 start-2 rounded-full bg-foreground/50 p-1.5 text-background"><L size={14} /></span>}
    </a>; })}
  </div>;
}
