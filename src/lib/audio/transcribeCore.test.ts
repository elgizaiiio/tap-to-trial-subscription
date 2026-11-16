import { afterEach, expect, it, vi } from "vitest";
const key = vi.hoisted(() => vi.fn());
vi.mock("@/lib/keys/providerKey", () => ({ getProviderKey: key }));
import { transcribeAudio } from "./transcribeCore";
afterEach(() => { vi.unstubAllGlobals(); key.mockReset(); });
it("uses direct Deepgram without a Lovable credential", async () => {
  key.mockResolvedValue("public-provider-fixture");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ results: { channels: [{ alternatives: [{ transcript: "ازيك" }] }] } }));
  vi.stubGlobal("fetch", fetcher);
  const result = await transcribeAudio(new Blob(["voice"], { type: "audio/webm" }), { language: "en" });
  expect(new URL(fetcher.mock.calls[0][0]).hostname).toBe("api.deepgram.com");
  expect(new URL(fetcher.mock.calls[0][0]).searchParams.get("language")).toBe("multi");
  expect(result.body.text).toBe("ازيك");
});
it("does not fall back to Lovable when the provider is missing", async () => {
  key.mockResolvedValue(null);
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  expect((await transcribeAudio(new Blob(["voice"]))).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
});