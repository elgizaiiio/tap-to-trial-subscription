import { describe, expect, it } from "vitest";
import { equalSecret, pairingCode, privateSender, telegramUpdate } from "./security";

describe("official channel privacy", () => {
  const message = { message_id: 1, from: { id: 123 }, chat: { id: 123, type: "private" }, text: "hello" };
  it("accepts only the sender's own private Telegram chat", () => {
    expect(privateSender(message)).toBe(true);
    expect(privateSender({ ...message, chat: { id: 456, type: "private" } })).toBe(false);
    expect(privateSender({ ...message, chat: { id: 123, type: "group" } })).toBe(false);
  });
  it("does not pair from a claimed email or numeric user id", () => {
    expect(pairingCode("/start user@example.com")).toBeNull();
    expect(pairingCode("/start 2121913091545878529")).toBeNull();
    expect(pairingCode(`/start ${"a".repeat(64)}`)).toBe("a".repeat(64));
  });
  it("rejects absent or different webhook credentials", () => {
    expect(equalSecret("", "expected")).toBe(false);
    expect(equalSecret("expectee", "expected")).toBe(false);
    expect(equalSecret("expected", "expected")).toBe(true);
  });
  it("rejects oversized input", () => {
    expect(telegramUpdate.safeParse({ update_id: 1, message: { ...message, text: "x".repeat(10001) } }).success).toBe(false);
  });
});
import { newShortCode, shortCode } from "./security";
describe("short channel codes", () => {
  it("parses codes with or without dash/start", () => {
    const c = newShortCode();
    expect(shortCode(c)).toBe(c);
    expect(shortCode(c.replace("-", "").toLowerCase())).toBe(c);
    expect(shortCode(`/start ${c}`)).toBe(c);
    expect(shortCode("hello there")).toBeNull();
  });
});
