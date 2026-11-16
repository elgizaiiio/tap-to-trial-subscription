import { afterEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc } }));
import { schedulerSecret } from "./runtimeCredentials.server";
afterEach(() => { vi.unstubAllEnvs(); rpc.mockReset(); });
it("prefers external Vault over the old hosting secret", async () => {
  rpc.mockResolvedValue({ data: "public-vault-fixture", error: null });
  vi.stubEnv("LOVABLE_CRON_SECRET", "public-legacy-fixture");
  expect(await schedulerSecret()).toBe("public-vault-fixture");
});
it("runs independently when only Supabase holds the secret", async () => {
  rpc.mockResolvedValue({ data: "public-vault-fixture", error: null });
  vi.stubEnv("LOVABLE_CRON_SECRET", "");
  vi.stubEnv("CEYO_CRON_SECRET", "");
  expect(await schedulerSecret()).toBe("public-vault-fixture");
});
it("fails closed when Vault cannot be read", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
  vi.stubEnv("LOVABLE_CRON_SECRET", "public-legacy-fixture");
  await expect(schedulerSecret()).rejects.toThrow("Runtime credential storage unavailable");
});