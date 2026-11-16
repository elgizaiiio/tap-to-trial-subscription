import { describe, expect, it, vi, afterEach } from "vitest";
import { mediaSource, montageInput, montageScript } from "./montage";
import { createVideoMontage } from "./videoTools";
import { searchStockMedia } from "./stockMedia";
import type { Computer } from "./e2b.server";

const scene = { source: "/home/user/photo.png", kind: "image", duration: 2 };
afterEach(() => vi.unstubAllGlobals());
describe("model-free montage", () => {
  it("accepts existing local/video assets without generation inputs", () => {
    const a = montageInput.parse({ scenes: [scene] });
    expect(a.scenes[0].source).toBe("/home/user/photo.png");
    expect(a.aspect_ratio).toBe("9:16");
    expect(a.resolution).toBe("720p");
  });
  it("rejects arbitrary files and insecure URLs", () => {
    for (const source of ["/etc/passwd", "/home/user/../secret", "http://example.org/x", "https://user:pass@example.org/x"]) expect(mediaSource.safeParse(source).success).toBe(false);
  });
  it("rejects backwards caption timing", () => {
    expect(montageInput.safeParse({ scenes: [scene], captions: [{ text: "test", start: 1, end: 0.5 }] }).success).toBe(false);
  });
  it("rejects captions beyond the actual timeline", () => {
    expect(montageInput.safeParse({ scenes: [scene], captions: [{ text: "test", start: 0, end: 3 }] }).success).toBe(false);
  });
  it("rejects generation-model and unknown parameters", () => {
    expect(montageInput.safeParse({ scenes: [scene], model: "wan" }).success).toBe(false);
  });
  it("serializes text as data, not executable Python", () => {
    const script = montageScript({ scenes: [scene], captions: [{ text: "'); import os; # مرحبا", start: 0, end: 1 }] });
    expect(script.startsWith("import json\nCONFIG = json.loads(")).toBe(true);
    expect(montageInput.parse({ scenes: [scene] }).scenes).toHaveLength(1);
  });
  it("exports a confirmed render before returning the private file card", async () => {
    const save = vi.fn().mockResolvedValue(JSON.stringify({ type: "ceyo.file", id: "artifact", artifact: true }));
    const computer = { prepareMedia: vi.fn().mockResolvedValue({ ok: true }), run: vi.fn().mockResolvedValue({ ok: true, output: JSON.stringify({ path: "/home/user/montage.mp4", mime: "video/mp4", duration: 2, width: 720, height: 1280, has_audio: false }) }) } as unknown as Computer;
    const result = JSON.parse(await createVideoMontage(computer, { scenes: [scene] }, save));
    expect(save).toHaveBeenCalledWith({ path: "/home/user/montage.mp4", name: "montage.mp4", mime: "video/mp4" });
    expect(result.id).toBe("artifact");
    expect(result.has_audio).toBe(false);
    expect(computer.run).toHaveBeenCalledWith(expect.any(String), "python", 300000);
  });
  it("does not export failed renders", async () => {
    const save = vi.fn();
    const computer = { prepareMedia: async () => ({ ok: true, output: "ready" }), run: async () => ({ ok: false, output: "render failed" }) } as unknown as Computer;
    await expect(createVideoMontage(computer, { scenes: [scene] }, save)).rejects.toThrow("render failed");
    expect(save).not.toHaveBeenCalled();
  });
  it("does not export unconfirmed output", async () => {
    const save = vi.fn();
    const computer = { prepareMedia: async () => ({ ok: true, output: "ready" }), run: async () => ({ ok: true, output: "done" }) } as unknown as Computer;
    await expect(createVideoMontage(computer, { scenes: [scene] }, save)).rejects.toThrow("did not confirm");
    expect(save).not.toHaveBeenCalled();
  });
  it("preserves stock license, author and source instead of inventing clips", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ query: { pages: { "1": { title: "Clip", imageinfo: [{ url: "https://upload.wikimedia.org/clip.webm", descriptionurl: "https://commons.wikimedia.org/wiki/Clip", mime: "video/webm", extmetadata: { Artist: { value: "<b>Author</b>" }, LicenseShortName: { value: "CC BY 4.0" } } }] } } } }) }));
    const result = JSON.parse(await searchStockMedia({ query: "city" }));
    expect(result.results[0]).toMatchObject({ author: "Author", license: "CC BY 4.0", source: "https://upload.wikimedia.org/clip.webm" });
  });
  it("returns an empty list when no licensed assets are found", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    expect(JSON.parse(await searchStockMedia({ query: "city" })).results).toEqual([]);
  });
});
describe("cinematic editing options", () => {
  it("accepts grades, transitions, motion and karaoke with real word timings", () => {
    const a = montageInput.parse({ scenes: [{ ...scene, motion: "ken_burns" }, { ...scene, kind: "video", speed: 2 }], grade: "teal_orange", transition: "whip", letterbox: true, grain: 0.3, caption_style: "karaoke", captions: [{ text: "hello world", start: 0, end: 2, words: [{ text: "hello", start: 0, end: 0.8 }, { text: "world", start: 0.9, end: 1.8 }] }] });
    expect(a.grade).toBe("teal_orange");
    expect(a.scenes[1].speed).toBe(2);
  });
  it("rejects karaoke words that do not match the caption text", () => {
    expect(montageInput.safeParse({ scenes: [scene], captions: [{ text: "hello world", start: 0, end: 2, words: [{ text: "hello", start: 0, end: 1 }] }] }).success).toBe(false);
  });
  it("rejects word timings outside their caption", () => {
    expect(montageInput.safeParse({ scenes: [scene], captions: [{ text: "hi", start: 0, end: 1, words: [{ text: "hi", start: 0.5, end: 1.6 }] }] }).success).toBe(false);
  });
  it("rejects unknown grades and invalid accent colours", () => {
    expect(montageInput.safeParse({ scenes: [scene], grade: "instagram" }).success).toBe(false);
    expect(montageInput.safeParse({ scenes: [scene], accent: "red" }).success).toBe(false);
  });
  it("skips keyed libraries when no key is added and reports them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const result = JSON.parse(await searchStockMedia({ query: "city", source: "all" }));
    expect(result.unavailable).toEqual(expect.arrayContaining(["pexels (no key added)", "pixabay (no key added)"]));
  });
  it("drops non-HTTPS asset links from libraries", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [{ url: "http://x.org/a.jpg", foreign_landing_url: "https://x.org", license: "by" }] }) }));
    expect(JSON.parse(await searchStockMedia({ query: "city", kind: "image", source: "openverse" })).results).toEqual([]);
  });
});

import { groupWords } from "./wordTiming";
describe("measured word timing", () => {
  it("groups words into karaoke captions that pass montage validation", () => {
    const caps = groupWords([{ word: "اهلا", start: 0.1, end: 0.5 }, { word: "بيك", punctuated_word: "بيك.", start: 0.6, end: 0.9 }, { word: "في", start: 2, end: 2.2 }, { word: "Ceyo", start: 2.3, end: 2.8 }], 5);
    expect(caps.map((c) => c.text)).toEqual(["اهلا بيك.", "في Ceyo"]);
    expect(montageInput.safeParse({ scenes: [{ ...scene, duration: 3 }], caption_style: "karaoke", captions: caps }).success).toBe(true);
  });
  it("caps words per caption", () => {
    const words = Array.from({ length: 7 }, (_, i) => ({ word: `w${i}`, start: i * 0.3, end: i * 0.3 + 0.2 }));
    expect(groupWords(words, 3).map((c) => c.words.length)).toEqual([3, 3, 1]);
  });
});
