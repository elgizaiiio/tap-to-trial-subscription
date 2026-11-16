import { z } from "zod";
import renderer from "./motion.py?raw";
import { mediaSource } from "./montage";

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const line = (max: number) => z.string().trim().min(1).max(max);
const duration = z.number().min(1).max(20);
const scene = z.discriminatedUnion("type", [
  z.object({ type: z.literal("title"), duration, title: line(90), subtitle: line(140).optional(), show_logo: z.boolean().default(true) }).strict(),
  z.object({ type: z.literal("cards"), duration, title: line(90).optional(), cards: z.array(z.object({ title: line(70), body: line(140).optional(), tags: z.array(line(28)).max(4).default([]) }).strict()).min(1).max(4) }).strict(),
  z.object({ type: z.literal("chat"), duration: duration.refine((d) => d >= 3, "Chat scenes need at least 3 s"), prompt: line(120), reply: line(160), placeholder: line(40).optional() }).strict(),
  z.object({ type: z.literal("image"), duration, source: mediaSource, title: line(90).optional() }).strict(),
  z.object({ type: z.literal("cta"), duration, title: line(90), button: line(36), url: line(60).optional(), show_logo: z.boolean().default(true) }).strict(),
]);
export const MOTION_SCENES = ["title", "cards", "chat", "image", "cta"] as const;

export const motionInput = z.object({
  scenes: z.array(scene).min(1).max(12),
  aspect_ratio: z.enum(["16:9", "9:16", "1:1", "4:5"]).default("16:9"),
  resolution: z.enum(["720p", "1080p"]).default("1080p"),
  theme: z.object({ background: color.default("#0A0B10"), glow1: color.default("#22D3EE"), glow2: color.default("#8B5CF6"), accent: color.default("#5AC8FA") }).strict().default({ background: "#0A0B10", glow1: "#22D3EE", glow2: "#8B5CF6", accent: "#5AC8FA" }),
  logo: mediaSource.optional(),
  brand: z.string().trim().max(40).optional(),
  captions: z.array(z.object({ text: line(160), start: z.number().min(0), end: z.number().positive() }).strict().refine((c) => c.end > c.start, "Caption end must follow its start")).max(80).default([]),
  narration: mediaSource.optional(),
  narration_offset: z.number().min(0).max(10).default(0.3),
  music: z.union([z.literal("ambient"), z.literal("none"), mediaSource]).default("ambient"),
  music_volume: z.number().min(0).max(1).default(0.3),
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,80}\.mp4$/).default("motion.mp4"),
}).strict().superRefine((a, ctx) => {
  const total = a.scenes.reduce((n, s) => n + s.duration, 0);
  if (total > 60) ctx.addIssue({ code: "custom", message: "Motion videos are limited to 60 seconds; split longer pieces" });
  if (a.captions.some((c) => c.end > total + 0.01)) ctx.addIssue({ code: "custom", message: "Caption timing exceeds video duration" });
});
export type MotionInput = z.infer<typeof motionInput>;

export const motionToolProperties = {
  scenes: { type: "array", description: "Ordered scenes. title{title,subtitle?,show_logo?} | cards{title?,cards:[{title,body?,tags?}] 1-4} | chat{prompt,reply,placeholder?} (min 3 s) | image{source,title?} (screenshot/product shot in a glass frame) | cta{title,button,url?,show_logo?}. Each needs duration (s).", items: { type: "object", properties: { type: { type: "string", enum: MOTION_SCENES }, duration: { type: "number" }, title: { type: "string" }, subtitle: { type: "string" }, show_logo: { type: "boolean" }, cards: { type: "array", items: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, tags: { type: "array", items: { type: "string" } } }, required: ["title"] } }, prompt: { type: "string" }, reply: { type: "string" }, placeholder: { type: "string" }, source: { type: "string" }, button: { type: "string" }, url: { type: "string" } }, required: ["type", "duration"] } },
  aspect_ratio: { type: "string", enum: ["16:9", "9:16", "1:1", "4:5"] }, resolution: { type: "string", enum: ["720p", "1080p"] },
  theme: { type: "object", description: "#RRGGBB colours: background, glow1, glow2, accent (match the brand)", properties: { background: { type: "string" }, glow1: { type: "string" }, glow2: { type: "string" }, accent: { type: "string" } } },
  logo: { type: "string", description: "HTTPS image or /home/user/ path of the brand logo" }, brand: { type: "string" },
  captions: { type: "array", description: "Glass subtitle pills; use the captions returned by create_voiceover (already offset-free, add narration_offset)", items: { type: "object", properties: { text: { type: "string" }, start: { type: "number" }, end: { type: "number" } }, required: ["text", "start", "end"] } },
  narration: { type: "string", description: "Voiceover path returned by create_voiceover" }, narration_offset: { type: "number", description: "Seconds before the voice starts (default 0.3)" },
  music: { type: "string", description: "'ambient' (built-in soft bed, default), 'none', or an HTTPS/home path" }, music_volume: { type: "number" }, name: { type: "string" },
};

/** Serializes validated data only; frames are drawn inside the isolated computer. */
export function motionScript(raw: unknown) {
  const input = motionInput.parse(raw);
  return `import json\nCONFIG = json.loads(${JSON.stringify(JSON.stringify(input))})\n${renderer}`;
}
