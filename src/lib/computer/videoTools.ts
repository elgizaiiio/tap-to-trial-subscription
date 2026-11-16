import type { Computer } from "./e2b.server";
import { montageInput, montageScript } from "./montage";
import { motionInput, motionScript } from "./motion";
import { synthesizeVoiceover } from "@/lib/audio/voiceover.server";
import { groupWords } from "./wordTiming";

/** Render and export in one tool so the task cannot close before delivery. */
export async function createVideoMontage(computer: Computer, raw: unknown, save: (input: { path: string; name: string; mime: string }) => Promise<string>) {
  const input = montageInput.parse(raw);
  const ready = await computer.prepareMedia();
  if (!ready.ok) throw new Error(ready.output);
  const result = await computer.run(montageScript(input), "python", 300000);
  if (!result.ok) throw new Error(result.output.slice(-1800));
  const lines = result.output.trim().split("\n");
  let metadata: { path: string; name: string; mime: string; duration: number; width: number; height: number; has_audio: boolean } | undefined;
  for (const line of lines) {
    try { const value = JSON.parse(line); if (value.path === `/home/user/${input.name}` && value.mime === "video/mp4") metadata = value; } catch { /* other execution output */ }
  }
  if (!metadata) throw new Error("Renderer did not confirm a video file; nothing was exported.");
  const artifact = JSON.parse(await save({ path: metadata.path, name: input.name, mime: "video/mp4" }));
  return JSON.stringify({ ...artifact, duration: metadata.duration, width: metadata.width, height: metadata.height, has_audio: metadata.has_audio, instruction: `Video saved privately; the chat displays its file card. ${metadata.has_audio ? "Supplied audio mixed." : "This video is silent."} Source-clip audio is removed; narration/music must be supplied explicitly. No image/video generation model used.` });
}

/** Professional narration: generated with Cartesia, placed on the task computer for the renderers. */
export async function createVoiceover(computer: Computer, raw: unknown, key: string | null) {
  const v = await synthesizeVoiceover(raw, key);
  const path = `/home/user/${v.input.name}`;
  await computer.writeFile(path, v.wav, "audio/wav");
  const captions = groupWords(v.words.map((w) => ({ word: w.text, start: w.start, end: w.end })), 5);
  return JSON.stringify({ path, duration: v.duration, language: v.input.language, voice: v.voice.name, voice_id: v.voice.id, words: v.words.length, captions, instruction: `Narration saved at ${path}. Use it as narration in create_motion_video or create_video_montage; make scene durations add up to at least duration + narration_offset + 1 s. Captions are relative to the voice start: add narration_offset (motion) or the scene start (montage). Reuse voice_id for every line of the same video. To deliver the audio alone, export_file it.` });
}

/** Glass motion-graphics render and export in one tool so delivery cannot be skipped. */
export async function createMotionVideo(computer: Computer, raw: unknown, save: (input: { path: string; name: string; mime: string }) => Promise<string>) {
  const input = motionInput.parse(raw);
  const ready = await computer.prepareMedia();
  if (!ready.ok) throw new Error(ready.output);
  const result = await computer.run(motionScript(input), "python", 300000);
  if (!result.ok) throw new Error(result.output.slice(-1800));
  let metadata: { path: string; duration: number; width: number; height: number; has_audio: boolean; narration: boolean; music: string } | undefined;
  for (const line of result.output.trim().split("\n")) {
    try { const value = JSON.parse(line); if (value.path === `/home/user/${input.name}` && value.mime === "video/mp4") metadata = value; } catch { /* other output */ }
  }
  if (!metadata) throw new Error("Renderer did not confirm a video file; nothing was exported.");
  const artifact = JSON.parse(await save({ path: metadata.path, name: input.name, mime: "video/mp4" }));
  return JSON.stringify({ ...artifact, duration: metadata.duration, width: metadata.width, height: metadata.height, narration: metadata.narration, music: metadata.music, instruction: `Video saved privately; the chat displays its file card. ${metadata.narration ? "Voiceover mixed with ducked music." : "No voiceover."}` });
}

/** One-call promo: narration first, then motion scenes timed to it, rendered and delivered together. */
export async function createFullVideo(computer: Computer, raw: any, key: string | null, save: (input: { path: string; name: string; mime: string }) => Promise<string>) {
  const { script, language, gender, accent, speed, emotion, scenes, name, ...rest } = raw ?? {};
  if (!script || !Array.isArray(scenes) || !scenes.length) throw new Error("Write the spoken script and the scenes, then call again.");
  const voice = JSON.parse(await createVoiceover(computer, { text: script, language: language || "en", gender, accent, speed, emotion, name: "full_voice.wav" }, key));
  const offset = 0.3;
  const need = voice.duration + offset + 1;
  const total = scenes.reduce((t: number, s: any) => t + (Number(s.duration) || 3), 0);
  const scale = total < need ? need / total : 1;
  const timed = scenes.map((s: any) => ({ ...s, duration: Math.round((Number(s.duration) || 3) * scale * 10) / 10 }));
  const captions = (voice.captions as { text: string; start: number; end: number }[]).map((c) => ({ ...c, start: c.start + offset, end: c.end + offset }));
  return createMotionVideo(computer, { ...rest, scenes: timed, captions, narration: voice.path, narration_offset: offset, name: name || "video.mp4" }, save);
}
