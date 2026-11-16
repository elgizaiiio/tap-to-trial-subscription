import { describe, expect, it } from "vitest";
import { hostingerConfig } from "./hostinger";

describe("Hostinger mail configuration", () => {
  it("uses the verified Hostinger TLS endpoint instead of an invalid saved host", () => {
    expect(hostingerConfig({ HOSTINGER_SMTP_HOST: "invalid.example", HOSTINGER_SMTP_USER: "support@ceyo.si", HOSTINGER_SMTP_PASSWORD: "test-only" }))
      .toEqual({ host: "smtp.hostinger.com", port: 465, user: "support@ceyo.si", pass: "test-only", from: "support@ceyo.si", name: "Ceyo" });
  });
  it("does not enable a sender without mailbox credentials", () => {
    expect(hostingerConfig({ HOSTINGER_SMTP_USER: "support@ceyo.si" })).toBeNull();
  });
});