import { lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { ChatLink } from "./ChatLink";
import { splitVisualAnswer } from "./visualAnswer";
import { normalizeMathDelimiters } from "./mathAnswer";
import "katex/dist/katex.min.css";
import "@/styles/chat-previews.css";

const VisualWidget = lazy(() => import("./VisualWidget"));

export function FormattedAnswer({ text, onSend, decorate }: { text: string; onSend?: (text: string) => void; decorate?: (children: ReactNode) => ReactNode }) {
  return <div className="cx-formatted-answer">{splitVisualAnswer(text).map((part, i) => part.kind === "widget"
    ? <ClientOnly key={i}><Suspense fallback={<p role="status">Preparing visual…</p>}><VisualWidget html={part.content} onSend={onSend} /></Suspense></ClientOnly>
    : <ReactMarkdown key={i} remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: "ignore", throwOnError: false }]]} components={{
      a: ({ href, children }) => <ChatLink href={href}>{children}</ChatLink>,
      p: ({ children }) => <p>{decorate ? decorate(children) : children}</p>,
      li: ({ children }) => <li>{decorate ? decorate(children) : children}</li>,
      table: ({ children }) => <div className="cx-answer-table" role="region" aria-label="Answer table" tabIndex={0}><table>{children}</table></div>,
    }}>{normalizeMathDelimiters(part.content)}</ReactMarkdown>)}</div>;
}