/** Picks the CoArena model for each agent step by the kind of work; Cerebras stays the shared fallback. */
export type ModelRole = "orchestrator" | "fast" | "web" | "coding" | "vision";

/** Ordered CoArena model chains: the first available model wins, then the next, then Cerebras. */
export const MODEL_ROLES: Record<ModelRole, string[]> = {
  /** Plans and finishes big tasks only. */
  orchestrator: ["gpt-6-1-terra", "gemini-4-carbon", "gpt-6-luna"],
  /** Everyday chat and simple tool calls. */
  fast: ["gpt-6-luna", "gpt-6-1-sol"],
  /** Browsing, search and multi-step web work. */
  web: ["gpt-6-1-sol", "grok-4-7", "gpt-6-1-terra", "gpt-6-luna"],
  /** Code, files and the cloud computer. */
  coding: ["gemini-4-carbon", "gpt-6-1-terra", "gpt-6-luna"],
  /** Screenshots and user photos. */
  vision: ["gemini-4-carbon", "gpt-6-1-terra", "gpt-6-luna"],
};

const CODE_TOOLS = /^(run_code|file_editor|computer|run_python|run_shell|create_file|edit_file|save_file|github)/i;
const WEB_TOOLS = /^(browser|web_search|read_url|http_request|search_|scrape|social|apify_)/i;
const BIG_TASK = /(ابن|ابني|اعمل(لي)?\s+(موقع|متجر|تطبيق|بوت|مشروع)|متجر|موقع|تطبيق|مشروع|خط[ةه]|ابحث|بحث|حلل|تقرير|build|create\s+(a|an)\s|website|store|app\b|project|research|analy[sz]e|report|plan|automate|deploy|migrate)/i;

/** A big task gets the orchestrator to plan and to write the final answer. */
export function isBigTask(text: string): boolean {
  const t = text.trim();
  return t.length > 280 || BIG_TASK.test(t);
}

export interface StepContext {
  step: number;
  /** True on the final, tool-free step. */
  finalStep: boolean;
  bigTask: boolean;
  /** Tools called in the previous step. */
  lastTools: string[];
  /** The newest user message carries photos, or the last tool returned a screenshot. */
  hasImages: boolean;
}

export function pickRole(c: StepContext): ModelRole {
  if (c.bigTask && (c.step === 0 || c.finalStep)) return "orchestrator";
  if (c.hasImages) return "vision";
  if (c.lastTools.some((t) => CODE_TOOLS.test(t))) return "coding";
  if (c.lastTools.some((t) => WEB_TOOLS.test(t))) return "web";
  return c.bigTask ? "web" : "fast";
}

export function modelsFor(role: ModelRole): string[] {
  return MODEL_ROLES[role];
}
