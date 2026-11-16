/** @doc OpenManus-style str_replace_editor for the bot's cloud computer: builds a Python
 *  script (arguments travel base64-encoded, never interpolated) that views, creates and
 *  edits files under /home/user with one-level undo. */
export const FILE_EDITOR_COMMANDS = ["view", "create", "str_replace", "insert", "undo_edit"] as const;

export function fileEditorScript(args: Record<string, unknown>): string {
  const command = String(args.command ?? "");
  if (!(FILE_EDITOR_COMMANDS as readonly string[]).includes(command)) throw new Error(`command must be one of ${FILE_EDITOR_COMMANDS.join(", ")}`);
  const path = String(args.path ?? "");
  if (!path.startsWith("/home/user/") || path.split("/").includes("..")) throw new Error("path must be an absolute path under /home/user/");
  const payload = {
    command, path,
    file_text: args.file_text == null ? null : String(args.file_text),
    old_str: args.old_str == null ? null : String(args.old_str),
    new_str: args.new_str == null ? "" : String(args.new_str),
    insert_line: Number.isFinite(Number(args.insert_line)) ? Math.trunc(Number(args.insert_line)) : null,
    view_range: Array.isArray(args.view_range) ? args.view_range.slice(0, 2).map((n) => Math.trunc(Number(n))) : null,
  };
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))));
  return `import base64, json, os, shutil
a = json.loads(base64.b64decode("${b64}").decode("utf-8"))
p, cmd = a["path"], a["command"]
bak = "/home/user/.ceyo_undo/" + p.replace("/", "__")
def numbered(text, start=1):
    return "\\n".join(f"{i:6}\\t{l}" for i, l in enumerate(text.split("\\n"), start))
def backup():
    os.makedirs("/home/user/.ceyo_undo", exist_ok=True)
    if os.path.isfile(p): shutil.copyfile(p, bak)
if cmd == "view":
    if os.path.isdir(p):
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if not d.startswith(".")][:50]
            if root.count("/") - p.rstrip("/").count("/") > 2: continue
            for f in files[:200]: print(os.path.join(root, f))
    else:
        t = open(p, encoding="utf-8", errors="replace").read()
        r = a["view_range"]
        if r:
            lines = t.split("\\n"); s = max(1, r[0]); e = len(lines) if len(r) < 2 or r[1] == -1 else r[1]
            print(numbered("\\n".join(lines[s-1:e]), s))
        else: print(numbered(t[:20000]))
elif cmd == "create":
    if a["file_text"] is None: raise SystemExit("file_text is required for create")
    os.makedirs(os.path.dirname(p), exist_ok=True); backup()
    open(p, "w", encoding="utf-8").write(a["file_text"]); print(f"Created {p} ({len(a['file_text'])} chars)")
elif cmd == "str_replace":
    t = open(p, encoding="utf-8").read(); o = a["old_str"]
    if not o: raise SystemExit("old_str is required")
    n = t.count(o)
    if n == 0: raise SystemExit("old_str was not found exactly; view the file and copy the exact text")
    if n > 1: raise SystemExit(f"old_str appears {n} times; include more surrounding lines so it is unique")
    backup(); t = t.replace(o, a["new_str"], 1); open(p, "w", encoding="utf-8").write(t)
    line = t[: t.find(a["new_str"])].count("\\n") + 1 if a["new_str"] else 1
    seg = t.split("\\n")[max(0, line - 4): line + 4 + a["new_str"].count("\\n")]
    print("Edited. Snippet:\\n" + numbered("\\n".join(seg), max(1, line - 3)))
elif cmd == "insert":
    t = open(p, encoding="utf-8").read(); lines = t.split("\\n"); k = a["insert_line"]
    if k is None or k < 0 or k > len(lines): raise SystemExit(f"insert_line must be between 0 and {len(lines)}")
    backup(); lines[k:k] = a["new_str"].split("\\n"); open(p, "w", encoding="utf-8").write("\\n".join(lines)); print(f"Inserted after line {k}")
elif cmd == "undo_edit":
    if not os.path.isfile(bak): raise SystemExit("No edit to undo for this file")
    shutil.copyfile(bak, p); os.remove(bak); print(f"Restored previous version of {p}")
`;
}
