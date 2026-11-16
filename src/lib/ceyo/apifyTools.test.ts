import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apifyTools } from "./apifyTools.server";

const userId = "user-a";
const ref = "11111111-1111-4111-8111-111111111111";
function harness(responses: unknown[] = []) {
  let saved: { user_id: string; content: string; mime: string } | undefined;
  let owner = userId;
  const db = { from: vi.fn(() => {
    const query = { select: () => query, eq: (key: string, value: string) => { if (key === "user_id") owner = value; return query; }, insert: (data: typeof saved) => { saved = data; return query; }, single: async () => ({ data: saved?.user_id === owner ? { ...saved, id: ref } : null, error: null }) };
    return query;
  }) } as unknown as SupabaseClient;
  const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const value = responses.shift();
    return value instanceof Response ? value : new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
  });
  const tools = apifyTools({ db, userId, signal: new AbortController().signal }, { key: async () => "test-credential", fetch: fetcher as typeof fetch });
  const run = async (name: string, args: unknown) => {
    const selected = tools.find((t) => t.name === name);
    if (!selected) throw new Error("Missing tool");
    return selected.run(args);
  };
  return { run, fetcher, db, getSaved: () => saved };
}
afterEach(() => vi.unstubAllEnvs());
describe("Apify catalogue tools", () => {
  it("discovers the live catalogue with bounded pagination", async () => {
    const h = harness([{ data: { total: 100, items: [{ username: "apify", name: "instagram-scraper", title: "Instagram", currentPricingInfo: { price: 0.01 } }] } }]);
    const result = JSON.parse(await h.run("apify_search", { query: "instagram", limit: 2, offset: 4 }));
    expect(result.actors[0].actor).toBe("apify~instagram-scraper");
    expect(h.fetcher.mock.calls[0]?.[0]).toBe("https://api.apify.com/v2/store?search=instagram&limit=2&offset=4");
  });
  it("rejects unsafe actor paths before contacting the provider", async () => {
    const h = harness();
    await expect(h.run("apify_run", { actor: "../users/me", input: {} })).rejects.toThrow();
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("starts with a spending cap and saves a signed owner-bound reference", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-signing-key");
    const h = harness([{ data: { id: "run123", defaultDatasetId: "dataset123", status: "RUNNING" } }]);
    const result = JSON.parse(await h.run("apify_run", { actor: "apify~instagram-scraper", input: {} }));
    expect(result.reference).toBe(ref);
    expect(result.max_charge_usd).toBe(1);
    expect(h.fetcher.mock.calls[0]?.[0]).toContain("timeout=180&maxTotalChargeUsd=1");
    expect(h.getSaved()?.user_id).toBe("user-a");
    expect(JSON.parse(h.getSaved()?.content || "{}").signature).toHaveLength(64);
  });
  it("will not read a foreign or forged run reference", async () => {
    const h = harness();
    await expect(h.run("apify_results", { reference: ref })).rejects.toThrow("not found");
    expect(h.fetcher).not.toHaveBeenCalled();
  });
  it("reports terminal provider errors once and redacts credentials", async () => {
    const h = harness([new Response("invalid test-credential", { status: 403 })]);
    await expect(h.run("apify_search", { query: "instagram" })).rejects.toThrow("Apify [403]: invalid [redacted]");
    expect(h.fetcher).toHaveBeenCalledTimes(1);
  });
  it("renders completed social data as valid JSON and caches repeated dataset reads", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-signing-key");
    const h = harness([{ data: { id: "run123", defaultDatasetId: "dataset123", status: "RUNNING" } }, { data: { status: "SUCCEEDED" } }, [{ url: "https://instagram.com/reel/123", caption: "x".repeat(40000), likesCount: 23 }]]);
    await h.run("apify_run", { actor: "apify~instagram-scraper", input: {} });
    const result = JSON.parse(await h.run("apify_results", { reference: ref }));
    expect(result.widget).toBe("social_results");
    expect(result.data.items[0].kind).toBe("reel");
    expect(result.data.items[0].likes).toBe(23);
    expect(result.omitted_rows).toBe(1);
    await h.run("apify_results", { reference: ref });
    expect(h.fetcher).toHaveBeenCalledTimes(3);
  });
  it("does not describe a still-running dataset as a completed result", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-signing-key");
    const h = harness([{ data: { id: "run123", defaultDatasetId: "dataset123", status: "RUNNING" } }, { data: { status: "RUNNING" } }]);
    await h.run("apify_run", { actor: "apify~instagram-scraper", input: {} });
    await expect(h.run("apify_results", { reference: ref })).rejects.toThrow("not confirmed complete");
    expect(h.fetcher).toHaveBeenCalledTimes(2);
  });
});