import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pin, PinOff } from "lucide-react";

export type PinnedChatMessage = {
  key: string;
  text: string;
  speaker?: string;
};

export function pinnedMessagePreview(text: string, ar = false): string {
  return text
    .replace(/```[\s\S]*?```/g, ar ? " كود " : " Code ")
    .replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)|\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g, ar ? " معادلة " : " Equation ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 220);
}

/** A quiet shortcut to saved messages; the list only opens when there is more than one pin. */
export function PinnedMessages({
  messages,
  ar,
  onOpen,
  onUnpin,
}: {
  messages: PinnedChatMessage[];
  ar: boolean;
  onOpen: (key: string) => void;
  onUnpin: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const latest = messages[messages.length - 1];

  useEffect(() => { setOpen(false); }, [messages.length]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (!latest) return null;
  const latestText = pinnedMessagePreview(latest.text, ar);

  return (
    <div className="cx-pins" ref={root}>
      <button
        type="button"
        className="cx-pins-bar"
        aria-label={ar ? "الرسائل المثبتة" : "Pinned messages"}
        aria-expanded={messages.length > 1 ? open : undefined}
        title={latestText}
        onClick={() => {
          if (messages.length === 1) onOpen(latest.key);
          else setOpen((value) => !value);
        }}
      >
        <Pin size={13} aria-hidden />
        <span className="cx-pins-label">{ar ? "مثبت" : "Pinned"}</span>
        <span className="cx-pins-preview" dir="auto">{latestText}</span>
        {messages.length > 1 && <span className="cx-pins-count">{messages.length}</span>}
        {messages.length > 1 && <ChevronDown size={14} data-open={open} aria-hidden />}
      </button>

      {open && messages.length > 1 && (
        <div className="cx-pins-list" role="list" aria-label={ar ? "كل الرسائل المثبتة" : "All pinned messages"}>
          {[...messages].reverse().map((message) => (
            <div className="cx-pins-item" role="listitem" key={message.key}>
              <button type="button" className="cx-pins-open" onClick={() => { setOpen(false); onOpen(message.key); }}>
                {message.speaker && <small dir="auto">{message.speaker}</small>}
                <span dir="auto">{pinnedMessagePreview(message.text, ar)}</span>
              </button>
              <button type="button" className="cx-pins-unpin" aria-label={ar ? "إلغاء تثبيت الرسالة" : "Unpin message"} onClick={() => onUnpin(message.key)}>
                <PinOff size={15} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
