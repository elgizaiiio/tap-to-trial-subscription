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

export type PhonePrompt = { text: string; send: boolean };
const KEY = "ceyo:phone-prompt";

/** Reads a prompt the phone passed in the URL, strips it from the address bar and keeps it until a chat takes it. */
export function capturePhonePrompt(href?: string): PhonePrompt | null {
  if (typeof window === "undefined") return null;
  const url = new URL(href ?? window.location.href);
  const raw = url.searchParams.get("ceyoPrompt");
  if (raw === null) return peekPhonePrompt();
  const prompt: PhonePrompt = { text: raw.slice(0, 1500), send: url.searchParams.get("ceyoSend") === "1" };
  url.searchParams.delete("ceyoPrompt");
  url.searchParams.delete("ceyoSend");
  if (!href) window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  if (!prompt.text.trim()) return null;
  try { sessionStorage.setItem(KEY, JSON.stringify(prompt)); } catch { /* storage unavailable */ }
  return prompt;
}

export function peekPhonePrompt(): PhonePrompt | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null");
    return v && typeof v.text === "string" && v.text.trim() ? { text: v.text, send: !!v.send } : null;
  } catch { return null; }
}

export function consumePhonePrompt(): PhonePrompt | null {
  const p = peekPhonePrompt();
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  return p;
}

export type PhoneBotIdentity = { name: string; path: string };
export function phoneBotIdentity(identity: PhoneBotIdentity): void {
  const fn = api()?.setBotIdentity; if (fn) safe(() => fn(JSON.stringify(identity)));
}
export function phoneLiveUpdate(title: string, text: string, progress = -1, details?: { name: string; path: string; state: string }): void {
  const fn = api()?.liveUpdate; if (fn) safe(() => fn(JSON.stringify({ title: title.slice(0, 60), text: text.slice(0, 300), progress, ...details })));
}
export function phoneLiveEnd(title: string, text: string, path = "/"): void {
  const fn = api()?.liveEnd; if (fn) safe(() => fn(JSON.stringify({ title: title.slice(0, 60), text: text.slice(0, 1500), path })));
}
/** UI fences are not notification messages. Do not invent success for error/cancelled/empty turns. */
export function phoneReply(turn?: { text: string; running: boolean; stopped: boolean; error: string | null }): string {
  if (!turn || turn.running || turn.stopped || turn.error) return "";
  return turn.text.replace(/```[\s\S]*?```/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/[*_#`]/g, "").trim().slice(0, 1500);
}
export function phoneSpeak(text: string, lang?: string): boolean {
  const fn = api()?.speak; if (!fn) return false; safe(() => fn(JSON.stringify({ text, lang }))); return true;
}
export function phoneRoutine(kind: "morning" | "night", hour: number, minute: number, on: boolean): void {
  const fn = api()?.setRoutine; if (fn) safe(() => fn(JSON.stringify({ kind, hour, minute, on })));
}
export function phoneOption(key: "car_on" | "guard_links" | "guard_bills" | "wake_on", on: boolean): void {
  const fn = api()?.setOption; if (fn) safe(() => fn(JSON.stringify({ key, on })));
}
export type ScreenMode = "off" | "notify" | "silence";
export function phoneScreenMode(value: ScreenMode): void {
  const fn = api()?.setOption; if (fn) safe(() => fn(JSON.stringify({ key: "screen_mode", value })));
}
export function phoneOpenSettings(which: "assistant" | "listener" | "notifications" | "alarms"): void {
  const fn = api()?.openSettings; if (fn) safe(() => fn(which));
}
export type PhoneAssistantStatus = Partial<Record<"notifications" | "listener" | "assistant" | "car_on" | "guard_links" | "guard_bills" | "morning_on" | "night_on" | "wake_on" | "screening" | "bundled_voice", boolean>> & { wake_status?: string; screen_mode?: ScreenMode } & Partial<Record<"morning_h" | "morning_m" | "night_h" | "night_m" | "digest_count", number>>;
export function phoneStatus(): PhoneAssistantStatus | null {
  const a = api(); if (!a?.status) return null;
  try { return JSON.parse(a.status()) as PhoneAssistantStatus; } catch { return null; }
}
