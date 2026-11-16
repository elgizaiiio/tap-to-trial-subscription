import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

describe("public Android design asset cache", () => {
  const context: Record<string, unknown> = { URL, self: { location: { origin: "https://app.ceyo.si" }, addEventListener() {} } };
  runInNewContext(readFileSync("public/ceyo-assets-sw.js", "utf8"), context);
  const cacheable = context.cacheable as (request: { method: string; url: string }) => boolean;
  it("retains only same-origin versioned design assets", () => {
    expect(cacheable({ method: "GET", url: "https://app.ceyo.si/assets/settings-Abc12345.js" })).toBe(true);
    expect(cacheable({ method: "GET", url: "https://other.example/assets/settings-Abc12345.js" })).toBe(false);
  });
  it("does not store pages, chats, accounts, payments or session requests", () => {
    for (const path of ["/", "/chat", "/settings/vault", "/api/chat", "/api/billing", "/auth", "/assets/plain.js", "/assets/settings-Abc12345.js?token=private"]) {
      expect(cacheable({ method: "GET", url: "https://app.ceyo.si" + path })).toBe(false);
    }
    expect(cacheable({ method: "POST", url: "https://app.ceyo.si/assets/settings-Abc12345.js" })).toBe(false);
  });
});