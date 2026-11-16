import { describe, expect, it } from "vitest";
import { isBigTask, modelsFor, pickRole } from "./modelRouter";

const base = { step: 3, finalStep: false, bigTask: false, lastTools: [] as string[], hasImages: false };
describe("model router", () => {
  it("uses the orchestrator only for big tasks at the start and the end", () => {
    expect(pickRole({ ...base, step: 0, bigTask: true })).toBe("orchestrator");
    expect(pickRole({ ...base, finalStep: true, bigTask: true })).toBe("orchestrator");
    expect(pickRole({ ...base, step: 0 })).toBe("fast");
  });
  it("routes by the tool just used", () => {
    expect(pickRole({ ...base, lastTools: ["run_code"] })).toBe("coding");
    expect(pickRole({ ...base, lastTools: ["web_search"] })).toBe("web");
    expect(pickRole({ ...base, hasImages: true })).toBe("vision");
  });
  it("routes Apify discovery and social extraction to the web specialist", () => {
    for (const name of ["apify_search", "apify_actor_details", "apify_run", "apify_status", "apify_results"]) {
      expect(pickRole({ ...base, lastTools: [name] })).toBe("web");
    }
  });
  it("detects big tasks", () => {
    expect(isBigTask("ابنيلي متجر على Supabase")).toBe(true);
    expect(isBigTask("ازيك")).toBe(false);
  });
  it("starts with the chosen CoArena models", () => {
    expect(modelsFor("orchestrator")[0]).toBe("gpt-6-1-terra");
    expect(modelsFor("fast")[0]).toBe("gpt-6-luna");
    expect(modelsFor("coding")[0]).toBe("gemini-4-carbon");
  });
});
