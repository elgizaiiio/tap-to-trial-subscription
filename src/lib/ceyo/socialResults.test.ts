import { describe, expect, it } from "vitest";
import { socialResults } from "./socialResults";

describe("real social result normalization", () => {
  it("distinguishes accounts, posts, reels and videos with actual metrics", () => {
    const rows = socialResults([
      { url: "https://www.instagram.com/example/", username: "example", followersCount: 125 },
      { url: "https://www.instagram.com/p/abc/", caption: "Photo", likesCount: 0 },
      { url: "https://www.instagram.com/reel/abc/", type: "Video", videoViewCount: 150 },
      { url: "https://www.youtube.com/watch?v=abc", title: "Film", viewCount: 10 },
    ]);
    expect(rows.map((r) => r.kind)).toEqual(["account", "post", "reel", "video"]);
    expect(rows[0].followers).toBe(125);
    expect(rows[1].likes).toBe(0);
    expect(rows[2].views).toBe(150);
  });
  it("does not fabricate media, counts or sources", () => {
    const [item] = socialResults([{ url: "https://x.com/example/status/12", text: "Hi" }]);
    expect(item?.image).toBeUndefined();
    expect(item?.likes).toBeUndefined();
    expect(socialResults([{ url: "javascript:alert(1)" }, { url: "https://instagram.com.evil.test/reel/12" }, { title: "No source" }])).toEqual([]);
  });
  it("recognizes TikTok nested author and authentic video URL", () => {
    const [item] = socialResults([{ webVideoUrl: "https://www.tiktok.com/@artist/video/123", authorMeta: { name: "artist" }, diggCount: 12 }]);
    expect(item?.platform).toBe("tiktok");
    expect(item?.kind).toBe("video");
    expect(item?.author).toBe("artist");
  });
});