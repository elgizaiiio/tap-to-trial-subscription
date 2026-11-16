import { afterEach, describe, expect, it, vi } from "vitest";
import { cerebrasRequest } from "./agentLoop.server";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("cerebrasRequest", () => {
  it("waits out a per-minute limit and continues instead of failing", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("limit", { status: 429, headers: { "retry-after": "2" } }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const pending = cerebrasRequest(["k1"], "{}", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2500);
    const res = await pending;
    expect(res.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps the same credential while waiting on a rate limit", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("limit", { status: 429 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const pending = cerebrasRequest(["a", "b"], "{}", new AbortController().signal);
    await vi.advanceTimersByTimeAsync(2500);
    const res = await pending;
    expect(res.status).toBe(200);
    const used = fetcher.mock.calls.map((c) => c[1].headers.Authorization);
    expect(new Set(used).size).toBe(1);
  });

  it("uses an explicitly authorized backup after HTTP 402", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("exhausted", { status: 402 })).mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetcher);
    const response = await cerebrasRequest(["a", "b"], "{}", new AbortController().signal, 0, true);
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[1][1].headers.Authorization).toBe("Bearer b");
  });

  it("does not use unapproved backup credentials after HTTP 402", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("exhausted", { status: 402 }));
    vi.stubGlobal("fetch", fetcher);
    expect((await cerebrasRequest(["a", "b"], "{}", new AbortController().signal, 0, false)).status).toBe(402);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not rotate on malformed HTTP 400 requests", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("bad request", { status: 400 }));
    vi.stubGlobal("fetch", fetcher);
    expect((await cerebrasRequest(["a", "b"], "{}", new AbortController().signal, 0, true)).status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("sends CoArena keys to CoArena with the strongest model", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetcher);
    const coa = { id: "env-coarena", table: "env" as const, api_key: "coa_x", failure_count: 0, provider: "coarena" as const };
    await cerebrasRequest([coa], JSON.stringify({ model: "qwen-3.8-27b" }), new AbortController().signal);
    expect(fetcher.mock.calls[0][0]).toBe("https://coarena.ai/api/v1/chat/completions");
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe("gpt-6-1-terra");
  });

  it("falls back to Cerebras when CoArena is busy", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(new Response("ok"));
    vi.stubGlobal("fetch", fetcher);
    const coa = { id: "env-coarena", table: "env" as const, api_key: "coa_x", failure_count: 0, provider: "coarena" as const };
    const res = await cerebrasRequest([coa, "csk"], JSON.stringify({ model: "qwen-3.8-27b" }), new AbortController().signal, 0, false);
    expect(res.status).toBe(200);
    expect(fetcher.mock.calls[1][0]).toBe("https://api.cerebras.ai/v1/chat/completions");
    expect(JSON.parse(fetcher.mock.calls[1][1].body).model).toBe("qwen-3.8-27b");
  });
});
