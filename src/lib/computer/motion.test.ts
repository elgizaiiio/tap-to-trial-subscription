import { describe, expect, it } from "vitest";
import { motionInput, motionScript } from "./motion";
import { chooseVoice, parseSse, voiceoverInput, wavFile } from "@/lib/audio/voiceover.server";

const base = { scenes: [{ type: "title", duration: 3, title: "Much more than an AI agent" }, { type: "cta", duration: 3, title: "Your bots are waiting", button: "Start with Ceyo" }] };

describe("motion video input", () => {
  it("accepts the glass scene set and fills defaults", () => {
    const v = motionInput.parse({ ...base, scenes: [...base.scenes, { type: "cards", duration: 4, cards: [{ title: "Every bot has its own computer", tags: ["Daily"] }] }, { type: "chat", duration: 4, prompt: "Plan a post", reply: "On it." }] });
    expect(v.aspect_ratio).toBe("16:9");
    expect(v.music).toBe("ambient");
    expect(v.narration_offset).toBe(0.3);
  });
  it("rejects videos longer than 60 seconds", () => {
    expect(() => motionInput.parse({ scenes: Array.from({ length: 4 }, () => ({ type: "title", duration: 16, title: "x" })) })).toThrow(/60 seconds/);
  });
  it("rejects chat scenes shorter than 3 seconds", () => {
    expect(() => motionInput.parse({ scenes: [{ type: "chat", duration: 2, prompt: "a", reply: "b" }] })).toThrow();
  });
  it("rejects more than four cards and unsafe sources", () => {
    expect(() => motionInput.parse({ scenes: [{ type: "cards", duration: 3, cards: Array.from({ length: 5 }, () => ({ title: "x" })) }] })).toThrow();
    expect(() => motionInput.parse({ ...base, logo: "http://example.com/a.png" })).toThrow();
    expect(() => motionInput.parse({ ...base, narration: "/home/user/../etc/passwd" })).toThrow();
  });
  it("rejects captions past the end", () => {
    expect(() => motionInput.parse({ ...base, captions: [{ text: "hi", start: 5, end: 7 }] })).toThrow(/duration/);
  });
  it("serializes text as JSON data, not code", () => {
    const script = motionScript({ ...base, scenes: [{ type: "title", duration: 3, title: "\"\"\"; import os; os.system('x')" }] });
    expect(script.startsWith("import json\nCONFIG = json.loads(")).toBe(true);
    expect(script.split("\n")[1]).not.toMatch(/^import os/);
  });
});

describe("voiceover", () => {
  const voices = [
    { id: "1", name: "En", language: "en", gender: "masculine", accents: [{ accent: "general-american", locale: "en-US", is_native: true }] },
    { id: "2", name: "Layan", language: "ar", gender: "feminine", accents: [{ accent: "khaleeji", locale: "ar-SA", is_native: true }] },
    { id: "3", name: "Youssef", language: "ar", gender: "masculine", accents: [{ accent: "modern-standard-arabic", locale: "ar-SA", is_native: true }] },
  ];
  it("picks a native voice with the requested gender", () => {
    expect(chooseVoice(voices, "ar", "masculine")?.id).toBe("3");
    expect(chooseVoice(voices, "ar", "feminine")?.id).toBe("2");
    expect(chooseVoice(voices, "en", "any")?.id).toBe("1");
  });
  it("prefers the requested accent", () => {
    expect(chooseVoice(voices, "ar", "any", "khaleeji")?.id).toBe("2");
  });
  it("limits speed and requires a language code", () => {
    expect(() => voiceoverInput.parse({ text: "hi", speed: 3 })).toThrow();
    expect(() => voiceoverInput.parse({ text: "hi", language: "arabic" })).toThrow();
  });
  it("parses audio chunks and word timings from the stream", () => {
    const pcm = btoa(String.fromCharCode(1, 0, 2, 0));
    const sse = `event: chunk\ndata: {"type":"chunk","data":"${pcm}"}\n\ndata: {"type":"timestamps","word_timestamps":{"words":["مرحبا","Ceyo"],"start":[0.1,0.6],"end":[0.5,0.6]}}\n\ndata: {"type":"done"}\n`;
    const r = parseSse(sse);
    expect(r.pcm.byteLength).toBe(4);
    expect(r.words).toEqual([{ text: "مرحبا", start: 0.1, end: 0.5 }, { text: "Ceyo", start: 0.6, end: 0.64 }]);
  });
  it("writes a valid WAV header", () => {
    const w = wavFile(new Uint8Array(88200));
    const v = new DataView(w.buffer);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe("RIFF");
    expect(v.getUint32(24, true)).toBe(44100);
    expect(v.getUint32(40, true)).toBe(88200);
  });
});
