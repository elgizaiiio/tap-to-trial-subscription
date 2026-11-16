/** Server-only: professional narration through Cartesia Sonic with measured word timings. */
import { z } from "zod";

const base = "https://api.cartesia.ai";
const version = "2026-08-14";
const SAMPLE_RATE = 44100;

export const voiceoverInput = z.object({
  text: z.string().trim().min(1).max(3000),
  language: z.string().regex(/^[a-z]{2}$/).default("en"),
  gender: z.enum(["masculine", "feminine", "any"]).default("any"),
  accent: z.string().trim().max(40).optional(),
  voice_id: z.string().uuid().optional(),
  speed: z.number().min(0.6).max(1.5).default(1),
  emotion: z.enum(["neutral", "calm", "excited", "content", "confident", "sad", "angry"]).optional(),
  name: z.string().regex(/^[a-zA-Z0-9_-]{1,60}\.wav$/).default("voiceover.wav"),
}).strict();
export type VoiceoverInput = z.infer<typeof voiceoverInput>;

type CatalogueVoice = { id: string; name: string; language?: string; gender?: string; accents?: { accent?: string; locale?: string; is_native?: boolean }[] };

/** Ranks catalogue voices: native speaker of the language first, then requested accent and gender. */
export function chooseVoice(voices: CatalogueVoice[], language: string, gender: string, accent?: string) {
  const hint = accent?.toLowerCase().replace(/\s+/g, "-");
  const score = (v: CatalogueVoice) => {
    let s = 0;
    if (v.language === language) s += 8;
    const native = (v.accents || []).find((a) => a.is_native);
    if (native?.locale?.startsWith(language)) s += 4;
    if (hint && (v.accents || []).some((a) => a.accent?.includes(hint) || a.locale?.toLowerCase().includes(hint))) s += 6;
    if (gender !== "any" && v.gender === gender) s += 5;
    return s;
  };
  return [...voices].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Parses Cartesia SSE text into PCM bytes and word timings. */
export function parseSse(text: string) {
  const chunks: Uint8Array[] = [];
  const words: { text: string; start: number; end: number }[] = [];
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    let d: any;
    try { d = JSON.parse(line.slice(5)); } catch { continue; }
    if (d.type === "chunk" && typeof d.data === "string") chunks.push(Uint8Array.from(atob(d.data), (c) => c.charCodeAt(0)));
    else if (d.type === "timestamps" && d.word_timestamps) {
      const t = d.word_timestamps;
      (t.words || []).forEach((w: string, i: number) => words.push({ text: w, start: Math.round(t.start[i] * 1000) / 1000, end: Math.round(Math.max(t.end[i], t.start[i] + 0.04) * 1000) / 1000 }));
    } else if (d.type === "error") throw new Error("Voiceover failed: " + String(d.error || d.message || "provider error").slice(0, 160));
  }
  const size = chunks.reduce((n, c) => n + c.byteLength, 0);
  const pcm = new Uint8Array(size);
  let o = 0;
  for (const c of chunks) { pcm.set(c, o); o += c.byteLength; }
  return { pcm, words };
}

/** Wraps 16-bit mono PCM in a WAV container. */
export function wavFile(pcm: Uint8Array, rate = SAMPLE_RATE) {
  const out = new Uint8Array(44 + pcm.byteLength);
  const v = new DataView(out.buffer);
  const str = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.byteLength, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, pcm.byteLength, true);
  out.set(pcm, 44);
  return out;
}

function failure(status: number) {
  if (status === 401 || status === 403) return "Voiceover service refused the account key.";
  if (status === 402 || status === 429) return "Voiceover credit or rate limit reached; try again later.";
  return `Voiceover service failed (${status}).`;
}

export async function synthesizeVoiceover(raw: unknown, key: string | null) {
  const a = voiceoverInput.parse(raw);
  if (!key) throw new Error("Voiceover is not configured (Cartesia key missing).");
  const headers = { "X-API-Key": key, "Cartesia-Version": version, "Content-Type": "application/json" };
  let voice: { id: string; name: string } | null = a.voice_id ? { id: a.voice_id, name: "custom" } : null;
  if (!voice) {
    const url = new URL(`${base}/voices`);
    url.searchParams.set("limit", "100"); url.searchParams.set("language", a.language);
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(failure(r.status));
    const list = ((await r.json()) as { data?: CatalogueVoice[] }).data || [];
    voice = chooseVoice(list, a.language, a.gender, a.accent);
    if (!voice) throw new Error(`No voice is available for language "${a.language}".`);
  }
  const generation_config: Record<string, unknown> = { speed: a.speed };
  if (a.emotion) generation_config.emotion = a.emotion;
  const r = await fetch(`${base}/tts/sse`, {
    method: "POST", headers, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ model_id: "sonic-3.6", transcript: a.text, voice: { mode: "id", id: voice.id }, language: a.language, add_timestamps: true, generation_config, output_format: { container: "raw", encoding: "pcm_s16le", sample_rate: SAMPLE_RATE } }),
  });
  if (!r.ok) throw new Error(failure(r.status));
  const { pcm, words } = parseSse(await r.text());
  if (!pcm.byteLength) throw new Error("Voiceover service returned no audio.");
  return { input: a, voice, wav: wavFile(pcm), duration: Math.round((pcm.byteLength / 2 / SAMPLE_RATE) * 1000) / 1000, words };
}
