import { z } from "zod";

export const socialItemSchema = z.object({
  platform: z.enum(["instagram", "youtube", "tiktok", "x", "facebook", "linkedin", "reddit", "social"]),
  kind: z.enum(["account", "post", "reel", "video"]),
  url: z.string().url().refine((v) => /^https:\/\//i.test(v)),
  title: z.string().max(300), text: z.string().max(2000).optional(),
  author: z.string().max(200).optional(), image: z.string().url().optional(),
  likes: z.number().nonnegative().optional(), views: z.number().nonnegative().optional(),
  followers: z.number().nonnegative().optional(),
  comments: z.number().nonnegative().optional(), shares: z.number().nonnegative().optional(),
  following: z.number().nonnegative().optional(), posts: z.number().nonnegative().optional(),
  handle: z.string().max(100).optional(), avatar: z.string().url().optional(),
  verified: z.boolean().optional(), date: z.string().max(40).optional(), duration: z.number().nonnegative().optional(),
  video: z.string().url().optional(),
});
export type SocialItem = z.infer<typeof socialItemSchema>;

const text = (row: Record<string, unknown>, keys: string[]) => keys.map((k) => row[k]).find((v) => typeof v === "string" && v.trim()) as string | undefined;
const count = (row: Record<string, unknown>, keys: string[]) => keys.map((k) => row[k]).find((v) => typeof v === "number" && Number.isFinite(v) && v >= 0) as number | undefined;
const https = (v?: string) => { try { const u = new URL(v || ""); return u.protocol === "https:" && !u.username && !u.password ? u.href : undefined; } catch { return undefined; } };

/** Normalize real provider rows only; never invent links, media or engagement. */
export function socialResults(rows: unknown[]): SocialItem[] {
  return rows.flatMap((raw): SocialItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as Record<string, unknown>;
    const url = https(text(row, ["url", "postUrl", "videoUrl", "profileUrl", "webVideoUrl", "linkedinUrl"]));
    if (!url) return [];
    const host = new URL(url).hostname.replace(/^www\./, "");
    const domain = (d: string) => host === d || host.endsWith(`.${d}`);
    const platform: SocialItem["platform"] = domain("instagram.com") ? "instagram" : domain("youtube.com") || domain("youtu.be") ? "youtube" : domain("tiktok.com") ? "tiktok" : domain("x.com") || domain("twitter.com") ? "x" : domain("facebook.com") ? "facebook" : domain("linkedin.com") ? "linkedin" : domain("reddit.com") ? "reddit" : "social";
    if (platform === "social") return [];
    const type = (text(row, ["type", "productType", "mediaType"]) || "").toLowerCase();
    const followers = count(row, ["followersCount", "followerCount", "followers"]);
    const kind: SocialItem["kind"] = /\/reels?\//.test(url) || /reel|clips/.test(type) ? "reel" : /video/.test(type) || /\/watch\?|\/shorts\/|\/video\//.test(url) || domain("youtu.be") ? "video" : followers !== undefined || /profile|account/.test(type) ? "account" : "post";
    const authorMeta = row.authorMeta && typeof row.authorMeta === "object" ? row.authorMeta as Record<string, unknown> : {};
    const author = text(row, ["ownerUsername", "username", "authorName", "channelName"]) || text(authorMeta, ["name", "nickName"]);
    const title = text(row, ["title", "fullName", "name", "username"]) || author || platform;
    const item = { platform, kind, url, title: title.slice(0, 300), author: author?.slice(0, 200), text: text(row, ["caption", "text", "description", "biography"])?.slice(0, 2000), image: https(text(row, ["displayUrl", "thumbnailUrl", "profilePicUrlHD", "profilePicUrl", "thumbnail", "coverUrl"]) || text(authorMeta, ["avatar"])), likes: count(row, ["likesCount", "likeCount", "diggCount"]), views: count(row, ["videoViewCount", "viewCount", "playCount"]), followers,
      comments: count(row, ["commentsCount", "commentCount", "replyCount", "numComments"]), shares: count(row, ["sharesCount", "shareCount", "retweetCount", "repostCount"]),
      following: count(row, ["followsCount", "followingCount", "following"]), posts: count(row, ["postsCount", "mediaCount", "videoCount"]),
      handle: (text(row, ["ownerUsername", "username", "screenName"]) || text(authorMeta, ["name"]))?.replace(/^@/, "").slice(0, 100),
      avatar: https(text(row, ["ownerProfilePicUrl", "profilePicUrl", "authorAvatar"]) || text(authorMeta, ["avatar"])),
      verified: typeof row.verified === "boolean" ? row.verified : typeof row.isVerified === "boolean" ? row.isVerified : undefined,
      date: text(row, ["timestamp", "createdAt", "date", "uploadDate", "createTimeISO"])?.slice(0, 40),
      duration: count(row, ["videoDuration", "duration"]),
      video: (() => { const v = https(text(row, ["videoUrl", "videoPlayUrl", "downloadUrl"])); return v && v !== url && !/instagram\.com\/|tiktok\.com\/@|youtube\.com|youtu\.be/.test(v) ? v : undefined; })() };
    const checked = socialItemSchema.safeParse(item);
    return checked.success ? [checked.data] : [];
  });
}