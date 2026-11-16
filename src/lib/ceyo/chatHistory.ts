/** Storage/display speaker markers must never become model instructions.
 *  The newest user message keeps its attached photos as image parts so the model can see them. */
export function normalizeChatHistory(rows: { role: string; content: string; metadata?: unknown }[]) {
  const list = [...rows].reverse().filter((row) => {
    const meta = row.metadata as { incomplete?: boolean } | null;
    return row.content && !meta?.incomplete && ["user", "assistant"].includes(row.role);
  });
  const lastUser = list.map((r) => r.role).lastIndexOf("user");
  return list.map((row, i) => {
    const actionResult = (row.metadata as { action_result?: unknown } | null)?.action_result;
    if (row.role === "assistant" && typeof actionResult === "string") return { role: row.role, content: `${row.content}\nResult: ${actionResult}` };
    if (row.role === "assistant") return { role: row.role, content: row.content.replace(/\[\[speaker:[^\]]*\]\]/g, "").trim() };
    const images = (row.metadata as { images?: unknown } | null)?.images;
    const pics = Array.isArray(images) ? images.filter((u): u is string => typeof u === "string" && /^(data:image\/|https:)/.test(u)).slice(0, 4) : [];
    if (i === lastUser && pics.length) return { role: row.role, content: [{ type: "text", text: row.content }, ...pics.map((url) => ({ type: "image_url", image_url: { url } }))] as unknown as string };
    return { role: row.role, content: pics.length ? `${row.content}\n[${pics.length} photo(s) attached earlier]` : row.content };
  });
}
