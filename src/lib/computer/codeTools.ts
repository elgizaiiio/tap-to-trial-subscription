/** Bash builders for code search/outline/git on the sandbox. Inputs are passed as quoted data, never as code. */
export const shq = (s: string) => `'${String(s).replace(/'/g, `'\\''`)}'`;

function safePath(p: unknown, fallback = "/home/user"): string {
  const v = String(p ?? "").trim() || fallback;
  if (!v.startsWith("/home/user") || v.includes("..")) throw new Error("Path must be under /home/user/");
  return v;
}

const RG = "command -v rg >/dev/null || (sudo apt-get install -y -qq ripgrep >/dev/null 2>&1 || pip install -q ripgrep >/dev/null 2>&1)";

export function grepCodeScript(args: { pattern?: string; path?: string; glob?: string; ignore_case?: boolean; max_results?: number }): string {
  const pattern = String(args.pattern ?? "");
  if (!pattern) throw new Error("Missing pattern");
  const max = Math.min(Math.max(Number(args.max_results) || 100, 1), 400);
  const flags = ["-n", "--no-heading", "--color=never", "-M", "300"];
  if (args.ignore_case) flags.push("-i");
  if (args.glob) flags.push("-g", shq(args.glob));
  return `${RG}\nrg ${flags.join(" ")} -e ${shq(pattern)} ${shq(safePath(args.path))} 2>&1 | head -n ${max} || true`;
}

export function codeOutlineScript(args: { path?: string }): string {
  const p = safePath(args.path);
  return `${RG}\ncd ${shq(p)} 2>/dev/null || { echo "not found"; exit 0; }
if [ -f ${shq(p)} ]; then F=${shq(p)}; else F=.; fi
rg -n --no-heading --color=never -g '!node_modules' -g '!dist' -g '!.git' -e '^\\s*(export\\s+)?(default\\s+)?(async\\s+)?(function|class|interface|type|enum|const\\s+\\w+\\s*=\\s*(async\\s*)?\\()' -e '^\\s*(async\\s+)?def\\s+\\w+' -e '^\\s*class\\s+\\w+' -e '^\\s*(pub\\s+)?(fn|struct|impl|trait)\\s+' -e '^func\\s+' $F 2>/dev/null | head -n 400 || true`;
}

const GIT_ACTIONS = ["clone", "status", "diff", "log", "add", "commit", "branch", "checkout", "show"] as const;
export type GitAction = (typeof GIT_ACTIONS)[number];
export const gitActions = [...GIT_ACTIONS];

export function gitScript(args: { action?: string; repo?: string; url?: string; message?: string; ref?: string; paths?: string[] }): string {
  const action = String(args.action) as GitAction;
  if (!GIT_ACTIONS.includes(action)) throw new Error("Unknown git action");
  const repo = safePath(args.repo, "/home/user/repo");
  const ident = `git config --global user.email >/dev/null || { git config --global user.email bot@ceyo.app; git config --global user.name Ceyo; }`;
  if (action === "clone") {
    const url = String(args.url ?? "");
    if (!/^https:\/\/[\w.-]+\/[\w./~-]+$/.test(url)) throw new Error("Clone URL must be a public https URL");
    return `${ident}\ngit clone --depth 50 ${shq(url)} ${shq(repo)} 2>&1 | tail -n 5 && cd ${shq(repo)} && git log --oneline -n 5 && ls`;
  }
  const cd = `cd ${shq(repo)} || exit 1\n`;
  const ref = args.ref ? shq(args.ref) : "";
  const paths = (args.paths ?? []).map((p) => shq(p)).join(" ");
  switch (action) {
    case "status": return cd + "git status --short --branch";
    case "diff": return cd + `git --no-pager diff ${ref} --stat; git --no-pager diff ${ref} | head -c 30000`;
    case "log": return cd + "git --no-pager log --oneline -n 30";
    case "add": return cd + `git add ${paths || "-A"} && git status --short`;
    case "commit": return `${ident}\n${cd}git add -A && git commit -m ${shq(args.message || "Update")} 2>&1 | tail -n 3`;
    case "branch": return cd + (ref ? `git checkout -b ${ref}` : "git branch -a");
    case "checkout": if (!ref) throw new Error("Missing ref"); return cd + `git checkout ${ref}`;
    case "show": return cd + `git --no-pager show --stat ${ref || "HEAD"} | head -c 20000`;
  }
}

/** Zips a project folder (excluding dependencies/build output/.git) for export on explicit request. */
export function zipProjectScript(args: { path?: string; name?: string }): { script: string; out: string } {
  const p = safePath(args.path);
  const name = (String(args.name || "project").replace(/[^\w.-]/g, "_").replace(/\.zip$/i, "") || "project") + ".zip";
  const out = `/home/user/${name}`;
  return { out, script: `command -v zip >/dev/null || sudo apt-get install -y -qq zip >/dev/null 2>&1\ncd ${shq(p)} && rm -f ${shq(out)} && zip -qr ${shq(out)} . -x 'node_modules/*' '*/node_modules/*' '.git/*' 'dist/*' 'build/*' '.next/*' '__pycache__/*' '.env' '.env.*' && ls -la ${shq(out)}` };
}
