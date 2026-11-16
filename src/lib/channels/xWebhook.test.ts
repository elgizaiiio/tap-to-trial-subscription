import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { handleXWebhook } from "./xWebhook.server";
import { xCrcResponse } from "./xSecurity";

// Public test fixture, never a real credential.
const fixture = "public-unit-test-fixture";
const read = async () => fixture;
const url = "https://example.com/api/public/channels/xchat";
Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
describe("X channel security boundary", () => {
  it("answers a CRC challenge without caching", async () => {
    const response = await handleXWebhook(new Request(`${url}?crc_token=public-challenge`), read);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const result = await response.json();
    expect(result.response_token.startsWith("sha256=")).toBe(true);
  });
  it("rejects an unsigned message before reading its JSON", async () => {
    const response = await handleXWebhook(new Request(url, { method: "POST", body: "not-json" }), read);
    expect(response.status).toBe(401);
  });
  it("rejects a modified signed body", async () => {
    const signature = await xCrcResponse(fixture, "original");
    const response = await handleXWebhook(new Request(url, { method: "POST", headers: { "x-twitter-webhooks-signature": signature }, body: "changed" }), read);
    expect(response.status).toBe(401);
  });
  it("never acknowledges encrypted messages without working crypto transport", async () => {
    const body = JSON.stringify({ data: { event_type: "chat.received", event_uuid: "public-event", payload: { encoded_event: "public-ciphertext" } } });
    const signature = await xCrcResponse(fixture, body);
    const response = await handleXWebhook(new Request(url, { method: "POST", headers: { "x-twitter-webhooks-signature": signature }, body }), read);
    expect(response.status).toBe(503);
  });
  it("does not substitute another token when Vault is unavailable", async () => {
    expect((await handleXWebhook(new Request(url), async () => null)).status).toBe(503);
  });
});