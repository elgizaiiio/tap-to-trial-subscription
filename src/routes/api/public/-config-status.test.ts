import { describe, expect, it } from "vitest";
import { configStatus } from "./config-status";

describe("configStatus", () => {
  it("does not require a Lovable account for server configuration", () => {
    expect(configStatus({ SUPABASE_URL: "https://example.com", SUPABASE_PUBLISHABLE_KEY: "public-fixture", SUPABASE_SERVICE_ROLE_KEY: "public-test-only", TELEGRAM_ADMIN_IDS: "123" }).ready).toBe(true);
  });
  it("reports a missing service role key without exposing values", () => {
    const r = configStatus({ SUPABASE_URL: "https://x", SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(r.ready).toBe(false);
    expect(r.settings.SUPABASE_SERVICE_ROLE_KEY).toBe(false);
    expect(r.settings.SUPABASE_URL).toBe(true);
    expect(JSON.stringify(r)).not.toContain("https://x");
  });
});
