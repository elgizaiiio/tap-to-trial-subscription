import { consumePhonePrompt, phoneLiveEnd, phoneLiveUpdate, phoneReply, phoneSpeak, takePhoneVoiceReply } from "@/lib/native/assistantBridge";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FormattedAnswer } from "@/components/chat/FormattedAnswer";
import { appCopyRestricted } from "@/lib/appInteractionPolicy";
import { ChatLink } from "@/components/chat/ChatLink";
import { PinnedMessages } from "@/components/chat/PinnedMessages";
import {
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Copy,
  Flag,
  Loader2,
  MessageSquareDot,
  MoreHorizontal,
  Plus,
  Paperclip,
  Camera,
  ImageIcon,
  Pin,
  PinOff,
  Reply,
  Search,
  SmilePlus,
  Square,
  TextCursor,
  Trash2,
  UserRound,
  X,
  CircleAlert,
  Mic,
  AudioLines,
  Video,
  Phone,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { agentApi, type AgentInfo, type SessionInfo } from "@/lib/agentsky/client";
import { refreshSessions, workspace } from "@/lib/agentsky/store";
import { useAgentSession } from "@/hooks/useAgentSession";
import { MediaCard, PlanCard, TaskCard, VideoProposalCard } from "@/components/agent/Cards";
import { calls } from "@/lib/calls/callStore";
import { HoldToRecord } from "./HoldToRecord";
import { VoiceMessage } from "./VoiceControls";
import { FilePreview } from "./FilePreview";
import { MediaCreator } from "./MediaCreator";
import "@/styles/chat-previews.css";
import { prefersVoiceReply, type AgentVoiceSettings, type RecordingOrigin } from "@/lib/audio/agentVoice";
import { cacheRecording } from "@/lib/audio/recordingCache";
import { microphoneRecording, transcribeRecording, unlockCallAudio } from "@/lib/audio/voiceClient";
import { ChoiceCard, ConnectAppsCard, SecretCard, readConnectApps } from "./HubCards";
import { AgentProposalCard } from "@/components/agent/AgentProposalCard";
import { orbStateFor, type AgentTurn } from "@/lib/agentsky/transcript";
import { groupTranscript, type AgentGroup } from "./hubStorage";
import { BotAvatar, HubSpinner, type HubLang } from "./HubParts";
import { readReactions, writeReactions, REACTIONS } from "./chatPrefs";
import { IntegrationApprovalCard } from "@/components/agent/IntegrationApprovalCard";
import { WalletApprovalCard } from "@/components/agent/WalletApprovalCard";
import { WalletBalanceCard } from "@/components/agent/WalletBalanceCard";
import { SocialResultsCard } from "@/components/agent/SocialResultsCard";
import { BrowserHandoffCard } from "@/components/agent/BrowserHandoffCard";
import { readTextAttachment } from "@/lib/ceyo/content";
import { saveDocument } from "@/lib/ceyo/resources";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isUsageExhausted } from "@/lib/ceyo/usage";

type Bubble = {
  key: string;
  turnId: string;
  role: "user" | "agent";
  text: string;
  at?: string;
  speaker?: AgentInfo;
  turn: any;
  partIndex: number;
  lastPart: boolean;
  turnIndex: number;
  messageId?: string;
  pinned?: boolean;
};

function fmtTime(at?: string) {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function Highlight({ text, q }: { text: string; q: string }): ReactNode {
  if (!q) return text.split(/(https?:\/\/[^\s<>]+)/g).map((part, index) => /^https?:\/\//.test(part) ? <ChatLink key={index} href={part}>{part}</ChatLink> : part);
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig"));
  return parts.map((p, i) => (p.toLowerCase() === q.toLowerCase() ? <mark key={i}>{p}</mark> : p));
}

function Composer({
  lang,
  placeholder,
  running,
  stopping,
  queue,
  replyTo,
  onCancelReply,
  onSend,
  onStop,
  onUnqueue,
  onConnect,
  members = [],
}: {
  lang: HubLang;
  placeholder: string;
  running: boolean;
  stopping: boolean;
  queue: { id: string; text: string }[];
  replyTo: string | null;
  onCancelReply: () => void;
  onSend: (text: string, origin?: RecordingOrigin, images?: string[]) => void;
  onStop: () => void;
  onUnqueue: (id: string) => void;
  onConnect: () => void;
  members?: AgentInfo[];
}) {
  const [text, setText] = useState("");
  const [plusOpen, setPlusOpen] = useState(false);
  const [mediaCreator, setMediaCreator] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const mediaIn = useRef<HTMLInputElement>(null);
  const addFiles = (list: FileList | null) => { if (list?.length) setFiles((c) => [...c, ...Array.from(list)].slice(0, 6)); };
  const [listening, setListening] = useState(false);
  const recordingAlive = useRef(true);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const ar = lang === "ar";

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);
  useEffect(() => { if (replyTo) textarea.current?.focus(); }, [replyTo]);
  const plusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!plusOpen) return;
    const close = (e: Event) => { if (!plusRef.current?.contains(e.target as Node)) setPlusOpen(false); };
    document.addEventListener("pointerdown", close, true);
    return () => document.removeEventListener("pointerdown", close, true);
  }, [plusOpen]);
  useEffect(() => { recordingAlive.current = true; return () => { recordingAlive.current = false; }; }, []);
  // A prompt handed over by the phone (assistant sheet, widget, share sheet, alerts) is sent or drafted once.
  useEffect(() => {
    const p = consumePhonePrompt();
    if (!p) return;
    if (p.send) onSend(p.text); else { setText(p.text); textarea.current?.focus(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const submit = async () => {
    const typed = text.trim();
    if (uploading || (!typed && !files.length)) return;
    setUploading(true);
    try {
      const pics = files.filter((f) => f.type.startsWith("image/"));
      const images = await Promise.all(pics.map(imageToDataUrl));
      const documents = await Promise.all(files.filter((f) => !f.type.startsWith("image/")).map(readTextAttachment));
      const refs: string[] = [];
      for (const doc of documents) {
        const saved = await saveDocument(doc);
        refs.push(`Attached document: ${doc.name}; read_file id=${saved.id}. Read its actual contents before answering.`);
      }
      const value = [typed || (images.length ? (ar ? "شوف الصورة دي" : "Look at this image") : ""), ...refs].filter(Boolean).join("\n\n");
      onSend(replyTo ? `> ${replyTo.slice(0, 200).replace(/\n/g, " ")}\n\n${value}` : value, {}, images);
      setText(""); setFiles([]); onCancelReply();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not send files"); }
    finally { setUploading(false); }
  };

  const sendRecording = async (blob: Blob) => {
    setUploading(true);
    try {
      const words = await transcribeRecording(blob);
      if (!recordingAlive.current) return;
      const recordingId = crypto.randomUUID();
      await cacheRecording(recordingId, blob);
      if (!recordingAlive.current) return;
      onSend(words, { voiceOrigin: "recording", recordingId });
    } catch (error) { if (recordingAlive.current) toast.error(error instanceof Error ? error.message : "Recording unavailable"); }
    finally { if (recordingAlive.current) setUploading(false); }
  };

  const mentionQuery = members.length ? /(?:^|\s)@([^\s@]*)$/.exec(text)?.[1] : undefined;
  const mentionMatches = mentionQuery === undefined ? [] : members.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);
  const pickMention = (m: AgentInfo) => { setText((t) => t.replace(/@([^\s@]*)$/, `@${m.name} `)); textarea.current?.focus(); };

  return (
    <div className="cx-composer-wrap">
      {mentionMatches.length > 0 && <div className="cx-mentions" role="listbox">{mentionMatches.map((m) => <button type="button" role="option" key={m.id} onPointerDown={(e) => { e.preventDefault(); pickMention(m); }}><BotAvatar agent={m} size={26} /><span>{m.name}</span></button>)}</div>}
      {queue.map((q) => (
        <div className="cx-queued" key={q.id}>
          <Clock size={14} /><span>{q.text}</span>
          <button type="button" onClick={() => onUnqueue(q.id)} aria-label="Remove"><X size={14} /></button>
        </div>
      ))}
      {replyTo && (
        <div className="cx-reply-chip"><Reply size={14} /><span dir="auto">{replyTo}</span><button type="button" aria-label="Cancel reply" onClick={onCancelReply}><X size={14} /></button></div>
      )}
      {mediaCreator && <MediaCreator ar={ar} onClose={() => setMediaCreator(false)} />}
      {files.length > 0 && (
        <div className="cx-files">{files.map((f, i) => f.type.startsWith("image/")
          ? <span key={`${f.name}-${i}`} className="cx-thumb"><ThumbImage file={f} /><button type="button" aria-label="Remove image" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><X size={12} /></button></span>
          : <span key={`${f.name}-${i}`} className="cx-file-chip"><Paperclip size={13} /><span>{f.name}</span><button type="button" aria-label="Remove file" onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}><X size={13} /></button></span>)}</div>
      )}
      <input ref={fileIn} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <input ref={camIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => addFiles(e.target.files)} />
      <input ref={mediaIn} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => addFiles(e.target.files)} />
      <div className="cx-composer" data-listening={listening}>
        <div className="cx-plus-wrap" ref={plusRef}>
          <button type="button" className="cx-circle" aria-label="More" onClick={() => setPlusOpen((o) => !o)}><Plus size={20} /></button>
          {plusOpen && (
            <div className="cx-pop cx-pop-up" role="menu">
              <button type="button" onClick={() => { fileIn.current?.click(); setPlusOpen(false); }}><Paperclip size={18} />{ar ? "اختيار ملف" : "Choose File"}</button>
              <button type="button" onClick={() => { camIn.current?.click(); setPlusOpen(false); }}><Camera size={18} />{ar ? "التقاط صورة" : "Take Photo"}</button>
              <button type="button" onClick={() => { mediaIn.current?.click(); setPlusOpen(false); }}><ImageIcon size={18} />{ar ? "صورة أو فيديو" : "Photo or Video"}</button>
            </div>
          )}
        </div>
        <textarea
          ref={textarea}
          rows={1}
          value={text}
          dir="auto"
          aria-label={placeholder}
          placeholder={placeholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (mentionMatches.length && (e.key === "Enter" || e.key === "Tab")) { e.preventDefault(); pickMention(mentionMatches[0]); return; }
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
          }}
        />
        {text.trim() || files.length ? (
          <Button variant="ghost" size="icon" type="button" className="cx-circle cx-send" aria-label="Send" disabled={uploading} onClick={() => void submit()}><ArrowUp size={18} /></Button>
        ) : (
          <>
            <HoldToRecord ar={ar} disabled={uploading} onRecording={setListening} onRecorded={sendRecording} />
          </>
        )}
      </div>
    </div>
  );
}

export function HubChat({
  lang,
  voiceSettings,
  voicePreferences,
  agent,
  group,
  agents,
  sessions,
  sessionId,
  tier,
  models,
  demo = false,
  onSession,
  onBack,
  onProfile,
  onHide,
  onDelete,
  onMarkUnread,
}: {
  lang: HubLang;
  voiceSettings: AgentVoiceSettings;
  voicePreferences: Record<string, AgentVoiceSettings>;
  agent: AgentInfo;
  group?: AgentGroup;
  agents: AgentInfo[];
  sessions: SessionInfo[];
  sessionId: string | null;
  tier: "free" | "pro";
  models: Parameters<typeof VideoProposalCard>[0]["models"];
  demo?: boolean;
  onSession: (id: string | null) => void;
  onBack: () => void;
  onProfile: () => void;
  onHide: () => void;
  onDelete?: () => void;
  onMarkUnread?: () => void;
}) {
  void sessions; void onHide;
  const nav = useNavigate();
  const [starting, setStarting] = useState(false);
  const [firstMessage, setFirstMessage] = useState<{ id: string; text: string; at: string; sessionId: string | null; voiceOrigin?: "recording"; recordingId?: string } | null>(null);
  const [toast, setToast] = useState<{ title: string; body?: string; tone?: "error" } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findIdx, setFindIdx] = useState(0);
  const [pinned, setPinned] = useState(true);
  const [sheet, setSheet] = useState<Bubble | null>(null);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [selectable, setSelectable] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [pinOverrides, setPinOverrides] = useState<Record<string, boolean>>({});
  const [swipe, setSwipe] = useState(0);
  const swipeStart = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const press = useRef<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const s = useAgentSession(demo ? null : sessionId, lang);
  const ar = lang === "ar";
  const title = group?.name || agent.name;

  useEffect(() => { setReactions(readReactions()); }, []);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(t); }, [toast]);

  const lastAgent = useMemo(() => [...s.turns].reverse().find((t) => t.type === "agent") as AgentTurn | undefined, [s.turns]);
  const orb = orbStateFor(lastAgent, s.running);
  // Own notifications at the chat level, where real steps and the final answer are available.
  const nativeTurn = useRef<{ turnId: string; shown: boolean; key: string } | null>(null);
  const nativeVoice = useRef(false);
  useEffect(() => {
    if (demo) return;
    const path = "/?chat=" + encodeURIComponent(group ? "group:" + group.id : "bot:" + agent.id) + (sessionId ? "&session=" + encodeURIComponent(sessionId) : "");
    const sync = () => {
      if (s.running) {
        if (takePhoneVoiceReply()) nativeVoice.current = true;
        const id = lastAgent?.id || "pending";
        if (!nativeTurn.current || nativeTurn.current.turnId !== id) nativeTurn.current = { turnId: id, shown: nativeTurn.current?.shown || false, key: "" };
        if (!document.hidden) return;
        const step = [...(lastAgent?.steps || [])].reverse().find((item) => item.status === "active");
        const state = orb === "tool" ? "tool" : orb === "talking" ? "talking" : "thinking";
        const label = ar ? (state === "tool" ? "يعمل…" : state === "talking" ? "يكتب…" : "يفكر…") : (state === "tool" ? "Working…" : state === "talking" ? "Writing…" : "Thinking…");
        const detail = step?.label || label;
        const key = state + detail;
        if (nativeTurn.current.key !== key) phoneLiveUpdate(label, detail, -1, { name: agent.name, path, state });
        nativeTurn.current.shown = true; nativeTurn.current.key = key;
      } else if (nativeTurn.current?.shown && !lastAgent?.running) {
        phoneLiveEnd(agent.name, phoneReply(lastAgent), path);
        nativeTurn.current = null;
      }
      if (!s.running && nativeVoice.current && lastAgent && !lastAgent.running) {
        nativeVoice.current = false;
        const reply = phoneReply(lastAgent);
        if (reply) phoneSpeak(reply, ar ? "ar" : "en");
      }
    };
    sync(); document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [demo, s.running, lastAgent, orb, ar, agent.id, agent.name, group?.id, sessionId]);


  useEffect(() => { setMenuOpen(false); setFindOpen(false); setFindQuery(""); setSheet(null); setReplyTo(null); setPinOverrides({}); }, [agent.id, sessionId]);
  const pinnedRef = useRef(pinned);
  pinnedRef.current = pinned;
  useLayoutEffect(() => { const el = scroller.current; if (el && pinned) el.scrollTop = el.scrollHeight; }, [s.turns, s.queue, pinned]);
  useEffect(() => {
    const el = scroller.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { if (pinnedRef.current) el.scrollTop = el.scrollHeight; });
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  });
  useEffect(() => { if (!demo && !s.running) void refreshSessions(); }, [s.running, demo]);
  useEffect(() => {
    // Refresh once when returning to the tab instead of polling every few seconds.
    if (demo || !sessionId || s.running) return;
    const onVisible = () => { if (document.visibilityState === "visible") window.dispatchEvent(new Event("ceyo-action-completed")); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [demo, sessionId, s.running]);
  useEffect(() => {
    const err = lastAgent?.error || s.error;
    if (err && !isUsageExhausted(err)) setToast({ title: ar ? "الوكيل مقدرش يرد" : "No reply received", body: err, tone: "error" });
    else if (isUsageExhausted(err)) setToast(null);
  }, [lastAgent?.error, s.error, ar]);

  /** Opens the app's sign-in right away, watches for the new account and tells the bot to carry on. */
  const connectInline = async (app: { id?: string; name: string }) => {
    try {
      const [{ integrations }, backend] = await Promise.all([import("@/lib/integrationsData"), import("@/lib/integrationBackend")]);
      const key = (app.id || app.name).toLowerCase().replace(/[\s_-]+/g, "");
      const item = integrations.find((i) => [i.id, i.app, i.name].some((v) => (v || "").toLowerCase().replace(/[\s_-]+/g, "") === key)) || ({ id: key, app: key, name: app.name, domain: `${key}.com`, description: "" } as never);
      const slug = backend.integrationSlug(item.app);
      const count = async () => (await backend.loadIntegrationConnections([item])).accounts.filter((a) => a.app === slug && a.status === "ACTIVE").length;
      const before = await count();
      const result = await backend.startIntegrationConnection(item);
      await backend.waitForConnectionRefresh(async () => (await count()) > before, result.popup);
      setToast({ title: ar ? `اتربط ${item.name}` : `${item.name} connected`, body: ar ? "الوكيل هيكمل شغله دلوقتي" : "Your bot is continuing" });
      void s.sendInternal(ar ? `اتربط ${item.name}. اتأكد من الحساب وكمّل الطلب الأصلي من النتائج المحفوظة من غير إعادة الخطوات اللي خلصت.` : `Connection completed for ${item.name}. Verify the account and continue the existing task from saved results; do not redo completed actions.`);
    } catch (error) {
      setToast({ title: ar ? "الربط ما كملش" : "Not connected", body: error instanceof Error ? error.message : "", tone: "error" });
    }
  };

  useEffect(() => {
    const onTask = (e: Event) => {
      const d = (e as CustomEvent<{ conversationId: string; task: string }>).detail;
      if (d?.task && d.conversationId === sessionId) void s.send(d.task);
    };
    window.addEventListener("ceyo-call-task", onTask);
    return () => window.removeEventListener("ceyo-call-task", onTask);
  }, [sessionId, s]);

  const [bgJob, setBgJob] = useState(false);
  useEffect(() => {
    if (demo || !sessionId) { setBgJob(false); return; }
    let alive = true;
    const check = async () => {
      const { supabase: legacyDb } = await import("@/integrations/supabase/legacyClient");
      const { data } = await legacyDb.from("agent_jobs").select("id").eq("conversation_id", sessionId).in("status", ["queued", "running"]).limit(1);
      if (alive) setBgJob(Boolean(data?.length));
    };
    void check().catch(() => {});
    const t = window.setInterval(() => void check().catch(() => {}), 8000);
    return () => { alive = false; window.clearInterval(t); };
  }, [sessionId, demo, s.running]);

  const startConversation = async (text: string, origin: RecordingOrigin = {}, images: string[] = []) => {
    if (demo) return;
    const messageId = crypto.randomUUID();
    setFirstMessage({ id: messageId, text, at: new Date().toISOString(), sessionId: null, ...origin });
    setStarting(true);
    try {
      const result = await agentApi.createSession({ agentId: agent.id, text, images, messageId, origin });
      workspace.upsertSession(result.session);
      setFirstMessage((pending) => pending ? { ...pending, sessionId: result.session.id } : null);
      onSession(result.session.id);
    } catch (error) {
      setFirstMessage(null);
      setToast({ title: ar ? "المحادثة مبدأتش" : "Could not start chat", body: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally {
      setStarting(false);
    }
  };

  // Flatten turns into bubbles (group replies split per speaker).
  const botReacts = useMemo<Record<string, string>>(() => ({}), [s.turns]);
  const bubbles = useMemo<Bubble[]>(() => {
    const out: Bubble[] = [];
    let lastAt: string | undefined;
    const now = new Date().toISOString();
    const source: any[] = demo ? [
      { id: "d1", type: "user", text: ar ? "عايزكم تجهزوا خطة الأسبوع" : "Plan this week for me", images: [], at: now },
      ...(group ? [{ id: "d2", type: "agent", text: group.memberIds.slice(0, 2).map((id) => `[[speaker: ${agents.find((a) => a.id === id)?.name}]] @${agents.find((a) => a.id === group.memberIds[0])?.name} ${ar ? "تمام، هبدأ دلوقتي." : "On it."}`).join("\n\n"), steps: [], cards: [] }] : [{ id: "d2", type: "agent", text: ar ? "أكيد، هقسمها لثلاث خطوات." : "Sure, three steps.", steps: [], cards: [] }]),
    ] : [...s.turns];
    if (!demo && firstMessage && (!firstMessage.sessionId || firstMessage.sessionId === sessionId) && !source.some((turn) => turn.type === "user" && turn.text === firstMessage.text)) {
      source.unshift({ ...firstMessage, type: "user", images: [] });
    }
    source.forEach((turn: any, turnIndex) => {
      if (turn.type === "user") {
        if (/^\[reacted \S+ to: /.test(turn.text || "")) return;
        lastAt = turn.at || lastAt;
        const messageId = demo ? undefined : turn.messageId || turn.id;
        out.push({ key: turn.id, turnId: turn.id, role: "user", text: turn.text, at: turn.at, turn, partIndex: 0, lastPart: true, turnIndex, messageId, pinned: messageId ? pinOverrides[messageId] ?? turn.pinned === true : false });
        return;
      }
      const parsed = group ? groupTranscript(turn.text || "") : (turn.messages?.length ? turn.messages : [turn.text || ""]).map((text: string) => ({ speaker: "", text }));
      const parts = parsed.length ? parsed : [{ speaker: "", text: "" }];
      // The bot can react to the user's message by starting its reply with [[react:EMOJI]].
      const lastUser = [...out].reverse().find((o) => o.role === "user");
      parts.forEach((part) => {
        part.text = part.text.replace(/\[\[react:\s*([^\]\s]{1,8})\s*\]\]\s*/g, (_m, e: string) => { if (lastUser) botReacts[lastUser.key] = e; return ""; });
      });
      parts.forEach((part, partIndex) => {
        const speaker = group && part.speaker ? agents.find((a) => group.memberIds.includes(a.id) && a.name === part.speaker) : undefined;
        const messageId = demo ? undefined : turn.messageId;
        out.push({ key: `${turn.id}-${partIndex}`, turnId: turn.id, role: "agent", text: part.text, at: lastAt, speaker: speaker || agent, turn, partIndex, lastPart: partIndex === parts.length - 1, turnIndex, messageId, pinned: messageId ? pinOverrides[messageId] ?? turn.pinned === true : false });
      });
    });
    return out;
  }, [s.turns, group, agents, agent, demo, ar, firstMessage, sessionId, pinOverrides]);

  const pinnedBubbles = useMemo(() => {
    const seen = new Set<string>();
    return bubbles.filter((bubble) => {
      if (!bubble.pinned || !bubble.messageId || !bubble.text || (bubble.role === "agent" && !bubble.lastPart) || seen.has(bubble.messageId)) return false;
      seen.add(bubble.messageId);
      return true;
    });
  }, [bubbles]);

  const openPinned = (key: string) => {
    setPinned(false);
    document.getElementById(`cx-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const togglePin = async (bubble: Bubble) => {
    const messageId = bubble.messageId;
    if (!messageId || demo) return;
    const next = !bubble.pinned;
    setPinOverrides((current) => ({ ...current, [messageId]: next }));
    setSheet(null);
    try {
      await agentApi.setMessagePinned(messageId, next);
    } catch (error) {
      setPinOverrides((current) => ({ ...current, [messageId]: !next }));
      setToast({ title: ar ? "التثبيت ما كملش" : "Could not update the pin", body: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  };

  const q = findQuery.trim();
  const matches = useMemo(() => (q ? bubbles.filter((b) => b.text.toLowerCase().includes(q.toLowerCase())).map((b) => b.key) : []), [bubbles, q]);
  useEffect(() => { setFindIdx(matches.length ? matches.length - 1 : 0); }, [q, matches.length]);
  useEffect(() => {
    const key = matches[findIdx];
    if (key) document.getElementById(`cx-${key}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [findIdx, matches]);

  // One loader for the whole reply: it stays mounted across brief idle gaps and only its text/avatar change.
  const rawBusy = s.running || starting;
  const [busy, setBusy] = useState(rawBusy);
  useEffect(() => {
    setBusy(rawBusy);
  }, [rawBusy]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!busy) { setTick(0); return; }
    const t = window.setInterval(() => setTick((n) => n + 1), 1800);
    return () => window.clearInterval(t);
  }, [busy]);
  const lastActivity = useRef<{ bot: AgentInfo; state: "thinking" | "tool" | "talking" } | null>(null);
  // Who is busy right now and what they are doing (thinking / using a tool / writing).
  const activity = useMemo(() => {
    if (!busy) return [] as { bot: AgentInfo; state: "thinking" | "tool" | "talking" }[];
    if (!s.running && !starting) return [] as { bot: AgentInfo; state: "thinking" | "tool" | "talking" }[];
    const live = s.running && lastAgent && s.turns[s.turns.length - 1] === lastAgent ? lastAgent : undefined;
    const st: "thinking" | "tool" | "talking" = orb === "tool" ? "tool" : orb === "talking" ? "talking" : "thinking";
    if (!group) return [{ bot: agent, state: (live ? st : "thinking") as "thinking" | "tool" | "talking" }];
    const coord = agents.find((a) => a.id === group.coordinatorId) || agent;
    const parts = live ? groupTranscript(live.text || "") : [];
    const last = parts[parts.length - 1]?.speaker;
    const speaker = last ? agents.find((a) => group.memberIds.includes(a.id) && a.name === last) : undefined;
    if (!speaker) return [{ bot: coord, state: (live ? st : "thinking") as "thinking" | "tool" | "talking" }];
    return [{ bot: speaker, state: st }];
  }, [busy, s.running, starting, s.turns, lastAgent, orb, group, agents, agent]);
  useEffect(() => { lastActivity.current = activity[0] || null; }, [activity]);

  const startPress = (b: Bubble) => {
    if (press.current) window.clearTimeout(press.current);
    press.current = window.setTimeout(() => { setSheet(b); navigator.vibrate?.(8); }, 430);
  };
  const cancelPress = () => { if (press.current) { window.clearTimeout(press.current); press.current = null; } };

  const react = (key: string, emoji: string) => {
    setReactions((cur) => {
      const next = { ...cur };
      const adding = next[key] !== emoji;
      if (adding) next[key] = emoji; else delete next[key];
      writeReactions(next);
      const target = bubbles.find((x) => x.key === key);
      if (adding && target?.role === "agent" && !demo && !s.running) window.setTimeout(() => s.send(`[reacted ${emoji} to: "${target.text.replace(/\s+/g, " ").slice(0, 120)}"]`), 0);
      return next;
    });
    setSheet(null);
  };
  const copy = async (text: string, label: string) => {
    if (appCopyRestricted()) { setSheet(null); return; }
    try { await navigator.clipboard.writeText(text); setToast({ title: label }); } catch { setToast({ title: ar ? "النسخ مش متاح" : "Copy unavailable", tone: "error" }); }
    setSheet(null);
  };

  const placeholder = group ? (ar ? "اسأل فريقك…" : "Ask your team…") : ar ? `رسالة لـ ${title}` : `Message ${title}`;
  const empty = bubbles.length === 0;

  return (
    <section className="cx-chat" data-has-pins={pinnedBubbles.length > 0 || undefined} aria-label={`${title} conversation`}>
      <header className="cx-head">
        <button type="button" className="cx-circle cx-glass" aria-label={ar ? "رجوع" : "Back"} onClick={onBack}><ChevronLeft size={22} /></button>
        <button type="button" className="cx-title-pill cx-glass" onClick={onProfile}>
          {group ? <span className="cx-stack">{group.memberIds.slice(0, 6).flatMap((id) => { const member = agents.find((a) => a.id === id); return member ? [<BotAvatar key={member.id} agent={member} size={22} />] : []; })}{group.memberIds.length > 6 && <span className="cx-stack-more">+{group.memberIds.length - 6}</span>}</span> : <BotAvatar agent={agent} size={24} state="idle" />}
          <strong dir="auto">{title}</strong>
        </button>
        <div className="cx-head-actions" data-calls={!group}>
          {!group && <div className="cx-head-calls">
            <Button variant="ghost" type="button" className="cx-hcall" aria-label={ar ? "مكالمة صوتية" : "Voice call"} title={ar ? "مكالمة صوتية" : "Voice call"} onClick={() => { setMenuOpen(false); calls.start({ kind: "voice", agent, agentIds: agents.map((a) => a.id), conversationId: sessionId }); try { navigator.vibrate?.(15); } catch {} unlockCallAudio(); }}><Phone size={19} strokeWidth={1.9} /></Button>
            <span className="cx-hcall-sep" aria-hidden="true" />
            <button type="button" className="cx-hcall" aria-label={ar ? "مكالمة فيديو" : "Video call"} title={ar ? "مكالمة فيديو" : "Video call"} onClick={() => { setMenuOpen(false); unlockCallAudio(); calls.start({ kind: "video", agent, agentIds: agents.map((a) => a.id), conversationId: sessionId }); }}><Video size={21} strokeWidth={1.9} /></button>
          </div>}
          <button type="button" className="cx-circle cx-glass cx-head-menu" aria-label="Menu" title={ar ? "المزيد" : "More"} aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}><MoreHorizontal size={20} /></button>
        </div>
        {menuOpen && <div className="cx-scrim" onPointerDown={() => setMenuOpen(false)} />}
        {menuOpen && (
          <div className="cx-pop cx-pop-down" role="menu">
            <button type="button" onClick={() => { setMenuOpen(false); onProfile(); }}><UserRound size={19} />{ar ? "عرض البروفايل" : "View Profile"}</button>
            <button type="button" onClick={() => { setMenuOpen(false); setFindOpen(true); }}><Search size={19} />{ar ? "دوّر في الشات" : "Find in Chat"}</button>
            {onDelete && <button type="button" data-danger="true" onClick={() => { setMenuOpen(false); onDelete(); }}><Trash2 size={19} />{ar ? "حذف" : "Delete"}</button>}
          </div>
        )}
      </header>

      <PinnedMessages
        messages={pinnedBubbles.map((bubble) => ({ key: bubble.key, text: bubble.text, speaker: bubble.role === "agent" ? bubble.speaker?.name || title : undefined }))}
        ar={ar}
        onOpen={openPinned}
        onUnpin={(key) => { const bubble = bubbles.find((item) => item.key === key); if (bubble) void togglePin(bubble); }}
      />

      {toast && (
        <div className="cx-toast" data-tone={toast.tone} role="status">
          {toast.tone === "error" && <CircleAlert size={18} />}
          <span><strong>{toast.title}</strong>{toast.body && <small>{toast.body}</small>}</span>
        </div>
      )}
      {s.error && <div className="cx-chat-error" role="alert"><CircleAlert size={18} /><span className="min-w-0 flex-1">{isUsageExhausted(s.error) ? ar ? "خلصت التجربة المجانية (3 أيام). اشترك علشان تكمل." : "Your 3-day free trial has ended. Subscribe to continue." : s.error}</span>{isUsageExhausted(s.error) && <Button className="shrink-0 whitespace-nowrap" variant="secondary" size="sm" onClick={() => nav("/settings/plans")}>{ar ? "اشترك" : "Subscribe"}</Button>}</div>}

      <div
        className="cx-scroll"
        ref={scroller}
        onScroll={(e) => { const el = e.currentTarget; setPinned(el.scrollHeight - el.scrollTop - el.clientHeight < 120); }}
        onPointerDown={(e) => { swipeStart.current = { x: e.clientX, y: e.clientY, active: false }; }}
        onPointerMove={(e) => {
          const st = swipeStart.current; if (!st) return;
          const dx = e.clientX - st.x, dy = e.clientY - st.y;
          if (!st.active && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy) * 1.5) { st.active = true; cancelPress(); }
          if (st.active) setSwipe(Math.max(-90, Math.min(0, ar ? -dx : dx)));
        }}
        onPointerUp={() => { swipeStart.current = null; setSwipe(0); }}
        onPointerCancel={() => { swipeStart.current = null; setSwipe(0); }}
      >
        {empty && !s.running && !starting ? (
          <div className="cx-empty">{(s.loading || starting) && <HubSpinner label={ar ? "لحظة…" : "One moment…"} />}</div>
        ) : (
          <div className="cx-column" style={{ transform: swipe ? `translateX(${ar ? -swipe : swipe}px)` : undefined, transition: swipe ? "none" : undefined }}>
            {s.loading && !bubbles.length && <HubSpinner label={ar ? "بنحمّل الرسائل…" : "Loading messages…"} />}
            {bubbles.map((b, i) => {
              const prev = bubbles[i - 1];
              const showDay = b.at && (!prev?.at || new Date(prev.at).toDateString() !== new Date(b.at).toDateString() || (new Date(b.at).getTime() - new Date(prev.at).getTime()) > 3600_000);
              const hit = matches[findIdx] === b.key;
              const handlers = {
                onPointerDown: () => startPress(b),
                onPointerUp: cancelPress,
                onPointerLeave: cancelPress,
                onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); cancelPress(); setSheet(b); },
              };
              const input = bubbles.slice(0, i).reverse().find((item) => item.role === "user");
              const voiceReply = b.role === "agent" && prefersVoiceReply(input?.turn.voiceOrigin, b.text) && !b.turn.running && !b.turn.error && !b.turn.stopped;
              const speaker = b.speaker || agent;
              const settings = speaker.voiceSettings || voicePreferences[speaker.id] || voiceSettings;
              const reaction = reactions[b.key] || botReacts[b.key];
              const time = fmtTime(b.at);
              return (
                <div key={b.key} id={`cx-${b.key}`} className="cx-row-wrap">
                  {showDay && <p className="cx-day">{new Date(b.at || "").toDateString() === new Date().toDateString() ? (ar ? "النهارده " : "Today ") : ""}{time}</p>}
                  {b.role === "user" ? (
                    <div className="cx-row cx-row-user">
                      <div className="cx-bubble cx-bubble-user" data-hit={hit} data-select={selectable === b.key} dir="auto" {...handlers}>
                        {b.partIndex === 0 && Array.isArray(b.turn.images) && b.turn.images.length > 0 && <span className="cx-user-images">{b.turn.images.map((src: string, k: number) => <img key={k} src={src} alt="" />)}</span>}
                        {b.turn.voiceOrigin === "recording" && b.turn.recordingId ? <VoiceMessage own text={b.text} recordingId={b.turn.recordingId} agentId={agent.id} agentIds={agents.map((a) => a.id)} settings={voiceSettings} ar={ar} /> : b.text.startsWith("> ") ? (() => { const [quote, ...rest] = b.text.split("\n\n"); return <><span className="cx-quote">{quote.slice(2)}</span><Highlight text={rest.join("\n\n")} q={q} /></>; })() : <CollapsibleText text={b.text} ar={ar}><Highlight text={b.text} q={q} /></CollapsibleText>}
                        {reaction && <em className="cx-reaction">{reaction}</em>}
                      </div>
                      <span className="cx-time">{time}</span>
                    </div>
                  ) : !b.text && !(b.lastPart && b.turn.cards?.length) ? null : (
                    <div className="cx-row cx-row-agent">
                      <div className="cx-avatar"><BotAvatar agent={b.speaker || agent} size={22} state="idle" /></div>
                      <div className="cx-agent-body">
                        {(group || b.partIndex === 0) && <span className="cx-author" dir="auto">{b.speaker?.name || title}</span>}
                        {b.lastPart && b.turn.cards?.filter((c: any) => c.kind === "plan").map((c: any) => <PlanCard key={c.id} title={c.title} steps={c.steps} lang={lang} />)}
                        {voiceReply && input ? <VoiceMessage text={b.text} recordingId={`${input.turn.recordingId || input.turnId}:${b.partIndex}`} agentId={speaker.id} agentIds={agents.map((a) => a.id)} settings={settings} ar={ar} /> : b.text && (
                          <div className="cx-bubble cx-bubble-agent" data-hit={hit} data-select={selectable === b.key} dir="auto" {...handlers}>
                            {q ? <p><Highlight text={b.text} q={q} /></p> : (
                              <FormattedAnswer text={b.text} decorate={(children) => mentionify(children, group, agents)} onSend={(text) => { void s.send(text); }} />
                            )}
                            {reaction && <em className="cx-reaction">{reaction}</em>}
                          </div>
                        )}
                        {b.lastPart && b.turn.cards?.map((card: any) => {
                          if (card.kind === "agent-proposal") return <AgentProposalCard key={card.id} proposal={card.proposal} />;
                          if (card.kind === "media") return <MediaCard key={card.id} media={card.media} lang={lang} />;
                          if (card.kind === "file") return <FilePreview key={card.id} id={card.id} name={card.name} content={card.content} />;
                          if (card.kind === "video") return <VideoProposalCard key={card.id} proposal={card.proposal} models={models} tier={tier} lang={lang} onUpgrade={() => nav("/pricing")} />;
                          if (card.kind === "question") return <ChoiceCard key={card.id} question={card.question} options={card.options} allowFreeText={card.allowFreeText} answered={card.answered} ar={ar} onAnswer={(v) => s.send(v)} />;
                          if (card.kind === "widget") {
                            const d = (card.data || {}) as Record<string, any>;
                            if (card.name === "connect_app") return <ConnectAppsCard key={card.id} apps={readConnectApps(d)} title={d.title || d.question} ar={ar} onAuthorize={(app) => void connectInline(app)} />;
                            if (card.name === "wallet_balance") return <WalletBalanceCard key={card.id} data={d} ar={ar} />;
                            if (card.name === "social_results") return <SocialResultsCard key={card.id} data={d} ar={ar} />;
                            if (card.name === "browser_handoff") return <BrowserHandoffCard key={card.id} id={card.id} data={d} onDone={(msg) => { void s.sendInternal(msg); }} />;
                            if (card.name === "wallet_approval") return <WalletApprovalCard key={card.id} data={d} />;
                            if (card.name === "integration_approval") return <IntegrationApprovalCard key={card.id} data={d} ar={ar} onDone={() => window.dispatchEvent(new Event("ceyo-action-completed"))} onApproved={(msg) => { void s.sendInternal(msg); }} />;
                            if (card.name === "secret" || card.name === "api_key") return <SecretCard key={card.id} name={String(d.name || d.title || "API key")} ar={ar} onOpen={() => nav("/settings/vault")} />;
                            if (card.name === "question" || card.name === "option_picker") {
                              const opts = (Array.isArray(d.options) ? d.options : Array.isArray(d.choices) ? d.choices : []).map((o: any) => typeof o === "string" ? o : String(o?.label ?? o?.name ?? o?.title ?? "")).filter(Boolean);
                              return <ChoiceCard key={card.id} question={d.question || d.title} options={opts} allowFreeText={d.allow_free_text !== false} ar={ar} onAnswer={(v) => s.send(v)} />;
                            }
                          }
                          if (card.kind === "task") return <TaskCard key={card.id} title={card.title} dueAt={card.dueAt} lang={lang} onOpen={() => nav("/agents")} />;
                          return null;
                        })}
                      </div>
                      <span className="cx-time">{time}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {!demo && s.requests.map((r) => (
              r.kind === "connect_app"
                ? <ConnectAppsCard key={r.id} title={r.question} apps={readConnectApps({ apps: r.options?.length ? r.options.map((o) => ({ id: o.id, name: o.label, description: o.description })) : [r.subject || r.question] })} ar={ar} onAuthorize={(app) => void connectInline(app)} />
                : <ChoiceCard key={r.id} question={r.question} options={r.options?.length ? r.options.map((o) => o.label) : r.kind === "approval" ? [ar ? "موافق" : "Approve", ar ? "لأ" : "Don't"] : []} allowFreeText={r.allow_free_text || r.kind === "question"} ar={ar} onAnswer={(v) => { s.setRequests((rs) => rs.filter((x) => x.id !== r.id)); s.send(v); }} />
            ))}
            {bgJob && !activity.length && <div className="cx-working" key="bg"><BotAvatar agent={agent} size={30} state="tool" /><span dir="auto" className="cx-working-text"><span className="cx-shimmer">{ar ? "لسه شغال على مهمتك في الخلفية…" : "Still working on your task in the background…"}</span></span></div>}
            {activity.slice(0, 1).map(({ bot, state }) => {
              const lastUserText = [...s.turns].reverse().find((t) => t.type === "user")?.text || "";
              const label = workingLabel(lastAgent?.steps || [], state, tick, /[\u0600-\u06FF]/.test(lastUserText) || (!lastUserText && ar));
              const others = group ? Math.max(0, group.memberIds.filter((id) => id !== bot.id).length) : 0;
              return (
                <div className="cx-working" key="working">
                  <BotAvatar agent={bot} size={30} state={state} />
                  <span dir="auto" className="cx-working-text">
                    {group && <b>{bot.name}{others > 0 && <span className="cx-working-others"> +{others} {ar ? "آخرون" : "others"}</span>} </b>}
                    <span key={label} className="cx-shimmer cx-label-swap">{label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!pinned && !empty && (
          <button type="button" className="cx-circle cx-glass cx-latest" aria-label="Scroll to latest" onClick={() => { setPinned(true); scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" }); }}><ChevronDown size={20} /></button>
        )}
      </div>

      {findOpen ? (
        <div className="cx-find">
          <label className="cx-find-input"><Search size={18} /><input autoFocus value={findQuery} onChange={(e) => setFindQuery(e.target.value)} placeholder={ar ? "دوّر في الشات" : "Find in chat"} />{q && <small>{matches.length ? findIdx + 1 : 0}/{matches.length}</small>}</label>
          <button type="button" className="cx-circle cx-glass cx-lg" aria-label="Previous" disabled={!matches.length} onClick={() => setFindIdx((i) => Math.max(0, i - 1))}><ChevronUp size={20} /></button>
          <button type="button" className="cx-circle cx-glass cx-lg" aria-label="Next" disabled={!matches.length} onClick={() => setFindIdx((i) => Math.min(matches.length - 1, i + 1))}><ChevronDown size={20} /></button>
          <button type="button" className="cx-done cx-glass" onClick={() => { setFindOpen(false); setFindQuery(""); }}>{ar ? "تم" : "Done"}</button>
        </div>
      ) : (
        <Composer
          lang={lang}
          placeholder={placeholder}
          running={s.running || starting}
          stopping={s.stopping}
          queue={s.queue}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={(text, origin, images) => { setPinned(true); setSelectable(null); if (!sessionId && !demo) void startConversation(text, origin, images); else s.send(text, images || [], origin); }}
          onStop={s.stop}
          onUnqueue={s.unqueue}
          onConnect={() => nav("/settings/apps")}
          members={group ? agents.filter((a) => group.memberIds.includes(a.id)) : undefined}
        />
      )}

      {sheet && (
        <>
          <div className="cx-sheet-scrim" onPointerDown={() => setSheet(null)} />
          <div className="cx-sheet" role="dialog" aria-label="Message options">
            <span className="cx-grip" />
            <div className="cx-emoji-grid">
              {REACTIONS.map((e) => <button type="button" key={e} data-active={reactions[sheet.key] === e} onClick={() => react(sheet.key, e)}>{e}</button>)}
              <button type="button" aria-label="More reactions" onClick={() => { const v = window.prompt(ar ? "اكتب إيموجي" : "Type an emoji")?.trim(); if (v) react(sheet.key, v.slice(0, 4)); }}><SmilePlus size={22} /></button>
            </div>
            <div className="cx-sheet-group">
              {sheet.messageId && !demo && <button type="button" onClick={() => void togglePin(sheet)}>{sheet.pinned ? <PinOff size={20} /> : <Pin size={20} />}{sheet.pinned ? (ar ? "إلغاء التثبيت" : "Unpin") : (ar ? "تثبيت" : "Pin")}</button>}
              <button type="button" onClick={() => { setReplyTo(sheet.text); setSheet(null); }}><Reply size={20} />{ar ? "رد" : "Reply"}</button>
              <button type="button" onClick={() => { onMarkUnread?.(); setSheet(null); setToast({ title: ar ? "اتعلمت غير مقروءة" : "Marked as unread" }); }}><MessageSquareDot size={20} />{ar ? "علّمها غير مقروءة" : "Mark as unread"}</button>
            </div>
            {!appCopyRestricted() && <div className="cx-sheet-group">
              <button type="button" onClick={() => void copy(sheet.text, ar ? "اتنسخت" : "Copied")}><Copy size={20} />{ar ? "نسخ" : "Copy"}</button>
              <button type="button" onClick={() => { setSelectable(sheet.key); setSheet(null); }}><TextCursor size={20} />{ar ? "تحديد النص" : "Select Text"}</button>
              <button type="button" onClick={() => void copy(sheet.turnId, ar ? "اتنسخ رقم الطلب" : "Request ID copied")}><Copy size={20} />{ar ? "نسخ رقم الطلب" : "Copy Request ID"}</button>
            </div>}
            <div className="cx-sheet-group">
              <button type="button" onClick={() => { setSheet(null); setToast({ title: ar ? "شكرًا، وصلنا البلاغ" : "Thanks, report received" }); }}><Flag size={20} />{ar ? "إبلاغ" : "Report"}</button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function mentionify(children: ReactNode, group: AgentGroup | undefined, agents: AgentInfo[]): ReactNode {
  if (!group) return children;
  const names = group.memberIds.map((id) => agents.find((a) => a.id === id)?.name).filter(Boolean) as string[];
  if (!names.length) return children;
  const re = new RegExp(`(@?(?:${names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")}))`, "g");
  const walk = (node: ReactNode): ReactNode => {
    if (typeof node === "string") return node.split(re).map((p, i) => (names.includes(p.replace(/^@/, "")) ? <span key={i} className="cx-mention">{p}</span> : p));
    if (Array.isArray(node)) return node.map((n, i) => <span key={i} style={{ display: "contents" }}>{walk(n)}</span>);
    return node;
  };
  return walk(children);
}

/** Shrinks a picked photo to a small JPEG data URL so it can travel with the message. */
function imageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name}: could not read this image`)); };
    img.src = url;
  });
}

function ThumbImage({ file }: { file: File }) {
  const [src, setSrc] = useState("");
  useEffect(() => { const u = URL.createObjectURL(file); setSrc(u); return () => URL.revokeObjectURL(u); }, [file]);
  return src ? <img src={src} alt={file.name} /> : null;
}

/** Very long user messages collapse to one line with a "Show more" link. */
export function CollapsibleText({ text, ar, children }: { text: string; ar: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (text.length < 400 || open) return <>{children}</>;
  return <span className="cx-collapsed"><span className="cx-collapsed-line" dir="auto">{text.replace(/\s+/g, " ").slice(0, 160)}</span><button type="button" className="cx-more" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>{ar ? "عرض المزيد" : "Show more"}</button></span>;
}

const STEP_WORDS: Record<string, [string, string]> = {
  search: ["Searching the web", "بدوّر على النت"],
  read: ["Reading the page", "بقرا الصفحة"],
  browse: ["Opening the website", "بفتح الموقع"],
  image: ["Making the image", "بعمل الصورة"],
  video: ["Making the video", "بعمل الفيديو"],
  helper: ["Asking a teammate", "بسأل زميل"],
  command: ["Running it on the computer", "بشغّلها على الكمبيوتر"],
  python: ["Running it on the computer", "بشغّلها على الكمبيوتر"],
  code: ["Writing code", "بكتب الكود"],
  edit: ["Editing the file", "بعدّل الملف"],
  file: ["Preparing your file", "بجهّز الملف"],
  memory: ["Checking what I remember", "بفتكر اللي أعرفه عنك"],
  email: ["Working in your email", "شغال على الإيميل"],
  calendar: ["Checking your calendar", "بشوف الكالندر"],
  map: ["Looking at the map", "بشوف الخريطة"],
  data: ["Crunching the numbers", "بحسب الأرقام"],
  task: ["Organizing your request", "برتب طلبك"],
  plan: ["Organizing the project", "برتب المشروع"],
  ask: ["Preparing a question", "بجهّز سؤال ليك"],
};

/** Status line under the avatar: follows what the bot is really doing, in the user's language. */
function workingLabel(steps: { kind: string; label: string; status: string }[], state: string, tick: number, ar: boolean) {
  const active = [...steps].reverse().find((st) => st.status === "active");
  if (active) {
    const w = STEP_WORDS[active.kind];
    if (w) return ar ? w[1] : w[0];
    return ar ? "براجع المطلوب" : "Checking your request";
  }
  if (state === "talking") return ar ? "بكتب الرد" : "Writing the reply";
  void tick;
  const recent = [...steps].reverse().find((st) => st.status === "done" && st.kind !== "thought");
  if (recent) return ar ? "براجع اللي لقيته" : "Reviewing what I found";
  return ar ? "بفكر في طلبك" : "Thinking about your request";
}
