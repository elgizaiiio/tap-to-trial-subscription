import { z } from "zod";
import renderer from "./montage.py?raw";
import analyzer from "./analyze.py?raw";

export const mediaSource = z.string().max(2000).refine((value) => {
  if (value.startsWith("/home/user/")) return !value.split("/").includes("..") && !/[\x00-\x1f]/.test(value);
  try { const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password; } catch { return false; }
}, "Use an HTTPS asset or a file under /home/user/");

const word = z.object({ text: z.string().min(1).max(60), start: z.number().min(0), end: z.number().positive() }).strict();
const caption = z.object({ text: z.string().min(1).max(240), start: z.number().min(0), end: z.number().positive(), position: z.enum(["center", "bottom", "top"]).default("bottom"), words: z.array(word).max(40).optional() }).strict()
  .refine((c) => c.end > c.start, "Caption end must follow its start")
  .refine((c) => !c.words || c.words.length === c.text.split(/\s+/).filter(Boolean).length, "words must list every word of text, in order")
  .refine((c) => !c.words || c.words.every((w, i, all) => w.start >= c.start && w.end <= c.end + 0.01 && w.end > w.start && (i === 0 || w.start >= all[i - 1].start)), "Word timings must be ordered inside the caption");
export const GRADES = ["none", "cinematic", "teal_orange", "noir", "golden", "cool", "vivid", "vintage", "moody"] as const;
export const TRANSITIONS = ["cut", "fade", "dissolve", "slide", "wipe", "zoom", "whip", "circle", "blur"] as const;
export const MOTIONS = ["none", "zoom_in", "zoom_out", "pan_left", "pan_right", "pan_up", "ken_burns"] as const;
export const CAPTION_STYLES = ["glass", "bold", "minimal", "karaoke"] as const;
export const montageInput = z.object({
  scenes: z.array(z.object({ source: mediaSource, kind: z.enum(["image", "video"]), duration: z.number().min(0.5).max(30), trim_start: z.number().min(0).default(0), motion: z.enum(MOTIONS).default("none"), speed: z.number().min(0.25).max(4).default(1) }).strict()).min(1).max(20),
  captions: z.array(caption).max(200).default([]),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5", "21:9"]).default("9:16"),
  resolution: z.enum(["720p", "1080p"]).default("720p"),
  transition: z.enum(TRANSITIONS).default("fade"),
  grade: z.enum(GRADES).default("none"),
  letterbox: z.boolean().default(false),
  grain: z.number().min(0).max(1).default(0),
  vignette: z.boolean().default(false),
  caption_style: z.enum(CAPTION_STYLES).default("glass"),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#FFD60A"),
  narration: mediaSource.optional(),
  music: mediaSource.optional(),
  music_volume: z.number().min(0).max(1).default(0.18),
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.mp4$/).default("montage.mp4"),
}).strict().superRefine((a, ctx) => {
  const duration = a.scenes.reduce((total, s) => total + s.duration, 0);
  if (duration > 120) ctx.addIssue({ code: "custom", message: "Split videos longer than 120 seconds into separate renders" });
  if (a.captions.some((c) => c.end > duration)) ctx.addIssue({ code: "custom", message: "Caption timing exceeds video duration" });
});

export const montageToolProperties = {
  scenes: { type: "array", items: { type: "object", properties: { source: { type: "string" }, kind: { type: "string", enum: ["image", "video"] }, duration: { type: "number" }, trim_start: { type: "number" }, motion: { type: "string", enum: MOTIONS }, speed: { type: "number", description: "0.25-4 playback speed for video scenes" } }, required: ["source", "kind", "duration"] } },
  captions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, start: { type: "number" }, end: { type: "number" }, position: { type: "string", enum: ["center", "bottom", "top"] }, words: { type: "array", description: "Measured per-word timings for karaoke (from analyze_media transcript or supplied data, never guessed)", items: { type: "object", properties: { text: { type: "string" }, start: { type: "number" }, end: { type: "number" } }, required: ["text", "start", "end"] } } }, required: ["text", "start", "end"] } },
  aspect_ratio: { type: "string", enum: ["9:16", "16:9", "1:1", "4:5", "21:9"] }, resolution: { type: "string", enum: ["720p", "1080p"] }, transition: { type: "string", enum: TRANSITIONS }, grade: { type: "string", enum: GRADES, description: "Cinematic colour grade applied to every scene for a consistent look" }, letterbox: { type: "boolean", description: "2.39:1 cinema bars" }, grain: { type: "number", description: "0-1 film grain" }, vignette: { type: "boolean" }, caption_style: { type: "string", enum: CAPTION_STYLES, description: "glass = iOS frosted card, bold = punchy reels title, minimal = subtle subtitle, karaoke = word highlight (needs words)" }, accent: { type: "string", description: "#RRGGBB highlight colour" }, narration: { type: "string" }, music: { type: "string" }, music_volume: { type: "number" }, name: { type: "string" },
};

/** Only serializes data here; all native media work runs in the isolated computer. */
export function montageScript(raw: unknown) {
  const input = montageInput.parse(raw);
  return `import json\nCONFIG = json.loads(${JSON.stringify(JSON.stringify(input))})\n${renderer}`;
}

const analyzeInput = z.object({ source: mediaSource, sensitivity: z.number().min(0.1).max(0.6).default(0.3), sheet_name: z.string().regex(/^[a-zA-Z0-9_-]{1,60}\.jpg$/).default("keyframes.jpg") }).strict();
/** Measures real media facts in the sandbox; no model, so timings are actual, not guessed. */
export function inspectMediaScript(raw: unknown) {
  const a = analyzeInput.parse(raw);
  return `import json\nSOURCE = json.loads(${JSON.stringify(JSON.stringify(a.source))})\nTHRESHOLD = ${a.sensitivity}\nNAME = json.loads(${JSON.stringify(JSON.stringify(a.sheet_name))})\n${analyzer}`;
}
