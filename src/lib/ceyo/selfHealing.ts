/** @doc Long-task support for the agent loop: tool-failure reflection and context compaction. */
type Msg = { role: string; content?: string | null; tool_calls?: any[]; tool_call_id?: string; name?: string };

export const MAX_SAME_FAILURES = 3;

/** Tracks repeated failures of the same tool+input so the agent changes approach instead of looping. */
export function createFailureTracker() {
  const counts = new Map<string, number>();
  return {
    record(name: string, args: unknown, ok: boolean): { attempt: number; note: string | null; giveUp: boolean } {
      const key = `${name}:${JSON.stringify(args ?? {}).slice(0, 500)}`;
      if (ok) { counts.delete(key); return { attempt: 0, note: null, giveUp: false }; }
      const attempt = (counts.get(key) ?? 0) + 1;
      counts.set(key, attempt);
      if (attempt >= MAX_SAME_FAILURES) return { attempt, giveUp: true, note: `This exact action failed ${attempt} times. Do not repeat it. Use a different method, or tell the user honestly what blocked you.` };
      return { attempt, giveUp: false, note: `Self-check (attempt ${attempt}/${MAX_SAME_FAILURES}): read the error, find the cause, then change the code, selector or approach before retrying. If on a website, use look to see the page first.` };
    },
  };
}

/** Shrinks old tool outputs when the transcript grows, keeping the latest ones intact. */
export function compactMessages(messages: Msg[], budget = 40_000, keepRecent = 5): Msg[] {
  const size = () => messages.reduce((n, m) => n + (typeof m.content === "string" ? m.content.length : 2000), 0);
  if (size() <= budget) return messages;
  const toolIdx = messages.map((m, i) => (m.role === "tool" ? i : -1)).filter((i) => i >= 0);
  for (const i of toolIdx.slice(0, Math.max(0, toolIdx.length - keepRecent))) {
    const c = typeof messages[i].content === "string" ? (messages[i].content as string) : "";
    if (c.length > 600) messages[i] = { ...messages[i], content: `${c.slice(0, 400)}\n…[older output shortened; rerun if needed]…\n${c.slice(-150)}` };
    if (size() <= budget) break;
  }
  return messages;
}

export const PLANNING_RULES = `Think, act, observe and verify internally until the goal is delivered. Speak naturally like a friend: one short sentence before substantial external work, then separate updates only for real discoveries or a change of approach. Never narrate tools, execution steps/counts or internal provider/fetching costs unless explicitly asked. Ordinary conversation, lookups and short requests need no plan or task card. Only genuinely large multi-part projects or requested checklists use update_plan, with real deliverable names and completion checks. Use the most suitable available tool; do not force simple work into start_long_task. When an action fails, inspect the cause and change approach; never replay a write with an unknown outcome. Verify before claiming completion. Ask only for the user's actual choice, sign-in or required approval. Explain real user purchases and necessary payments honestly. Final answer: the result itself, short and friendly, with descriptively named links/files and unfinished parts stated plainly.`;

/** The model printed a tool call as text (JSON, XML or harmony syntax) instead of calling it. */
export function looksLikeFakeToolCall(text: string, toolNames: readonly string[] = []): boolean {
  if (/```(json)?\s*\{[\s\S]*"(action|tool|tool_name|function|name)"\s*:/.test(text)) return true;
  if (/<\/?(tool_call|function_call|invoke)\b/i.test(text) || /\bto=functions\.\w+/.test(text)) return true;
  return toolNames.some((n) => n.length > 3 && new RegExp(`\\{\\s*"(name|tool)"\\s*:\\s*"${n}"`).test(text));
}

/** First-answer refusal or "do it yourself" instructions where tools could act instead. */
export function looksLikeRefusal(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(i can(?:'|no)t|i(?:'m| am) (?:unable|not able)|i don'?t have (?:access|the ability)|as an ai|you (?:can|will need to|need to|should) (?:run|install|deploy|open|go to))\b/.test(t)
    || /(لا أستطيع|لا استطيع|لا يمكنني|ما اقدرش|مقدرش|مش هقدر|معنديش صلاحية|ليس لدي (?:القدرة|صلاحية)|لا أملك (?:القدرة|صلاحية)|يمكنك (?:تشغيل|تثبيت|رفع)|عليك (?:تشغيل|تثبيت|رفع))/.test(text);
}

/** Asking an everyday user for technical identifiers, code or API steps the agent could find out itself. */
export function looksLikeTechnicalAsk(text: string): boolean {
  const jargon = /(`?\b(?:chat_id|user_id|channel_id|group_id|message_id|getupdates|webhook|endpoint|api key|json|curl|polling|bot api)\b`?)/i;
  const ask = /\b(please (?:provide|share|send)|provide (?:me|the)|share (?:the|your)|send me (?:the|your)|i need (?:you to|the|your|either)|could you (?:give|share|send|provide)|let me know (?:the|your))\b|(أحتاج|احتاج|محتاج|برجاء|يرجى|من فضلك (?:ابعت|شارك|زود)|ابعتلي|ابعت لي|زودني|شاركني|شارك(?:ني)? ال|لو تقدر تزودني|توفّرت|توفرت)/i;
  return jargon.test(text) && ask.test(text);
}

/** Anti-bot or error pages returned as "successful" reads; tell the agent to switch source instead of retrying. */
export function blockedPageNote(result: string): string | null {
  const head = result.slice(0, 1500);
  if (!/(just a moment\.\.\.|attention required|access denied|you don'?t have permission to access|verify you are (?:a )?human|are you a robot|enable javascript and cookies|captcha|request blocked|403 forbidden|status 403)/i.test(head)) return null;
  return "Note: this site blocked automated access (anti-bot page), so the content is NOT real. Don't retry the same site. Use another source: the search-result snippets you already have, a different shop/site, a price-comparison site, or the site's public API. Good-enough data with named sources beats no answer.";
}
