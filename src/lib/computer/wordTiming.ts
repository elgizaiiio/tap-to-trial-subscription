import { z } from "zod";

const input = z.object({ source: z.string().url().refine((u) => u.startsWith("https://"), "Public HTTPS audio/video URL required"), max_words_per_caption: z.number().int().min(1).max(12).default(5) }).strict();
type Word = { word: string; punctuated_word?: string; start: number; end: number };

/** Groups measured words into caption chunks whose `words` match the text exactly (karaoke-ready). */
export function groupWords(words: Word[], max: number) {
  const out: { text: string; start: number; end: number; words: { text: string; start: number; end: number }[] }[] = [];
  let cur: { text: string; start: number; end: number }[] = [];
  const flush = () => { if (cur.length) out.push({ text: cur.map((w) => w.text).join(" "), start: cur[0].start, end: cur[cur.length - 1].end, words: cur }); cur = []; };
  for (const w of words) {
    const text = (w.punctuated_word || w.word).trim().replace(/\s+/g, "");
    if (!text) continue;
    if (cur.length && w.start - cur[cur.length - 1].end > 0.6) flush();
    cur.push({ text, start: Math.round(w.start * 1000) / 1000, end: Math.round(w.end * 1000) / 1000 });
    if (cur.length >= max || /[.!?؟،,]$/.test(text)) flush();
  }
  flush();
  return out;
}

/** Real per-word timings from Deepgram (multilingual), never estimated. */
export async function transcribeWords(raw: unknown, key: string | null) {
  const a = input.parse(raw);
  if (!key) throw new Error("Speech timing is not configured (Deepgram key missing).");
  const r = await fetch("https://api.deepgram.com/v1/listen?model=nova-3&language=multi&smart_format=true&punctuate=true", { method: "POST", headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ url: a.source }), signal: AbortSignal.timeout(120000) });
  if (!r.ok) throw new Error(`Speech timing failed (${r.status}).`);
  const d = await r.json() as { results?: { channels?: { detected_language?: string; alternatives?: { transcript?: string; words?: Word[] }[] }[] } };
  const ch = d.results?.channels?.[0];
  const words = ch?.alternatives?.[0]?.words ?? [];
  return JSON.stringify({ language: ch?.detected_language ?? null, transcript: ch?.alternatives?.[0]?.transcript ?? "", captions: groupWords(words, a.max_words_per_caption), instruction: "These are measured timings relative to the start of this file. Shift by the scene start if the audio starts later, then pass captions to create_video_montage with caption_style karaoke and the same file as narration." });
}
