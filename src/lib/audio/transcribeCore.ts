/** Server-only speech-to-text through the owner's existing Deepgram provider. */
import { getProviderKey } from "@/lib/keys/providerKey";
import { transcribeOriginalRecording } from "./recordingTranscription.server";

export interface TranscribeResult {
  text: string;
  error?: string;
}


/**
 * Transcribes a recorded audio blob. Returns a plain `{ text }` payload so the
 * composer can append the words straight into the input.
 */
export async function transcribeAudio(
  file: Blob,
  opts: { language?: string; filename?: string } = {},
): Promise<{ status: number; body: TranscribeResult }> {
  if (!file || file.size === 0) {
    return { status: 400, body: { text: "", error: "Empty audio" } };
  }

  const apiKey = await getProviderKey("deepgram");
  if (!apiKey) return { status: 503, body: { text: "", error: "Speech-to-text is not configured" } };
  // Original speech language is detected; interface locale must not translate it.
  const resp = await transcribeOriginalRecording(file, apiKey);

  const raw = await resp.text();
  if (!resp.ok) {
    // Provider failures are not silently retried through another service.
    let message = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as { error?: string | { message?: string }; message?: string };
      message = (typeof parsed.error === "string" ? parsed.error : parsed.error?.message) || parsed.message || message;
    } catch {
      /* keep raw text */
    }
    return { status: resp.status, body: { text: "", error: message || `HTTP ${resp.status}` } };
  }

  try {
    const parsed = JSON.parse(raw) as { text?: string };
    return { status: 200, body: { text: String(parsed?.text ?? "").trim() } };
  } catch {
    return { status: 502, body: { text: "", error: "Invalid transcription response" } };
  }
}
