/** @doc Assistant features of the Ceyo Android app over the trusted `MegsyAndroid` interface:
 *  live "bot is working" notification + widget status, offline phone speech, daily routines, and prompts
 *  the phone hands to the app (`?ceyoPrompt=&ceyoSend=` from the assistant sheet, widget, share sheet or alerts).
 *  Every call is a no-op in a normal browser. */

type AssistantApi = {
  setBotIdentity?: (json: string) => void;
  liveUpdate?: (json: string) => void;
  liveEnd?: (json: string) => void;
  widgetStatus?: (json: string) => void;
  speak?: (json: string) => void;
  stopSpeaking?: () => void;
  setRoutine?: (json: string) => void;
  setOption?: (json: string) => void;
  status?: () => string;
  openSettings?: (which: string) => void;
};

const api = (): AssistantApi | null =>
  typeof window !== "undefined" && window.MegsyAndroid ? (window.MegsyAndroid as unknown as AssistantApi) : null;
const safe = (fn: () => void) => { try { fn(); } catch { /* bridge errors never break the web app */ } };

export const hasPhoneAssistant = () => !!api()?.liveUpdate;

export type PhonePrompt = { text: string; send: boolean; voice?: boolean };
const KEY = "ceyo:phone-prompt";

/** Reads a prompt the phone passed in the URL, strips it from the address bar and keeps it until a chat takes it. */
export function capturePhonePrompt(href?: string): PhonePrompt | null {
  if (typeof window === "undefined") return null;
  const url = new URL(href ?? window.location.href);
  const raw = url.searchParams.get("ceyoPrompt");
  if (raw === null) return peekPhonePrompt();
  const prompt: PhonePrompt = { text: raw.slice(0, 1500), send: url.searchParams.get("ceyoSend") === "1", ...(url.searchParams.get("ceyoVoice") === "1" ? { voice: true } : {}) };
  url.searchParams.delete("ceyoPrompt");
  url.searchParams.delete("ceyoSend");
  url.searchParams.delete("ceyoVoice");
  if (!href) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  if (!prompt.text.trim()) return null;
  try { sessionStorage.setItem(KEY, JSON.stringify(prompt)); } catch { /* storage unavailable */ }
  return prompt;
}

export function peekPhonePrompt(): PhonePrompt | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return v && typeof v.text === "string" && v.text.trim() ? { text: v.text, send: !!v.send, ...(v.voice === true ? { voice: true } : {}) } : null;
  } catch { return null; }
}

export function consumePhonePrompt(): PhonePrompt | null {
  const p = peekPhonePrompt();
  if (p?.voice && p.send) try { sessionStorage.setItem("ceyo:voice-reply", "1"); } catch { /* optional */ }
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return p;
}

export type PhoneBotIdentity = { name: string; path: string };
export function phoneBotIdentity(identity: PhoneBotIdentity): void {
  const a = api(); if (a?.setBotIdentity) safe(() => a.setBotIdentity?.(JSON.stringify(identity)));
}
export function phoneLiveUpdate(title: string, text: string, progress = -1, details?: { name: string; path: string; state: string }): void {
  const a = api(); if (a?.liveUpdate) safe(() => a.liveUpdate?.(JSON.stringify({ title: title.slice(0, 60), text: text.slice(0, 300), progress, ...details })));
}
export function phoneLiveEnd(title: string, text: string, path = "/"): void {
  const a = api(); if (a?.liveEnd) safe(() => a.liveEnd?.(JSON.stringify({ title: title.slice(0, 60), text: text.slice(0, 1500), path })));
}
/** UI fences are not notification messages. Do not invent success for error/cancelled/empty turns. */
export function phoneReply(turn?: { text: string; running: boolean; stopped: boolean; error: string | null }): string {
  if (!turn || turn.running || turn.stopped || turn.error) return "";
  return turn.text.replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_#`]/g, "").trim().slice(0, 1500);
}
export function phoneSpeak(text: string, lang?: string): boolean {
  const a = api(); if (!a?.speak) return false;
  try { a.speak(JSON.stringify({ text, lang })); return true; } catch { return false; }
}
export function takePhoneVoiceReply(): boolean {
  try { const on = sessionStorage.getItem("ceyo:voice-reply") === "1"; sessionStorage.removeItem("ceyo:voice-reply"); return on; } catch { return false; }
}
export function phoneRoutine(kind: "morning" | "night", hour: number, minute: number, on: boolean): void {
  const a = api(); if (a?.setRoutine) safe(() => a.setRoutine?.(JSON.stringify({ kind, hour, minute, on })));
}
export function phoneOption(key: "car_on" | "guard_links" | "guard_bills" | "wake_on", on: boolean): boolean {
  const a = api(); if (!a?.setOption) return false;
  try { a.setOption(JSON.stringify({ key, on })); return true; } catch { return false; }
}
export type ScreenMode = "off" | "notify" | "silence";
export function phoneScreenMode(value: ScreenMode): void {
  const a = api(); if (a?.setOption) safe(() => a.setOption?.(JSON.stringify({ key: "screen_mode", value })));
}
export function phoneOpenSettings(which: "assistant" | "listener" | "notifications" | "alarms" | "overlay" | "battery" | "test_voice"): void {
  const a = api(); if (a?.openSettings) safe(() => a.openSettings?.(which));
}
export type PhoneAssistantStatus = Partial<Record<"notifications" | "listener" | "assistant" | "car_on" | "guard_links" | "guard_bills" | "morning_on" | "night_on" | "wake_on" | "screening" | "bundled_voice" | "overlay" | "battery" | "recognizer", boolean>> & { wake_status?: string; screen_mode?: ScreenMode; recognizer_name?: string; recognizers?: string } & Partial<Record<"morning_h" | "morning_m" | "night_h" | "night_m" | "digest_count" | "spent_today", number>>;
export function phoneStatus(): PhoneAssistantStatus | null {
  const a = api(); if (!a?.status) return null;
  try {
    const value: unknown = JSON.parse(a.status());
    if (!value || typeof value !== "object" || !("wake_on" in value) || typeof value.wake_on !== "boolean") return null;
    return value as PhoneAssistantStatus;
  } catch { return null; }
}
