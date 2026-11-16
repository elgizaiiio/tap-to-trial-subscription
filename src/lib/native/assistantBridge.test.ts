import { describe, expect, it, beforeEach } from "vitest";
import { capturePhonePrompt, consumePhonePrompt, phoneReply } from "./assistantBridge";

describe("phone prompts", () => {
  beforeEach(() => sessionStorage.clear());
  it("keeps a sent prompt from the phone until a chat consumes it once", () => {
    const p = capturePhonePrompt("https://app.ceyo.si/?ceyoSend=1&ceyoPrompt=%D8%B5%D8%A8%D8%A7%D8%AD");
    expect(p).toEqual({ text: "صباح", send: true });
    expect(consumePhonePrompt()).toEqual({ text: "صباح", send: true });
    expect(consumePhonePrompt()).toBeNull();
  });
  it("treats prompts without ceyoSend=1 as drafts", () => {
    expect(capturePhonePrompt("https://app.ceyo.si/?ceyoPrompt=hi")).toEqual({ text: "hi", send: false });
  });
  it("ignores empty prompts", () => {
    expect(capturePhonePrompt("https://app.ceyo.si/?ceyoPrompt=%20")).toBeNull();
  });
});

describe("actual phone replies", () => {
  it("uses the bot answer, not a task-ready placeholder", () => {
    expect(phoneReply({ text: "النتيجة: 42", running: false, stopped: false, error: null })).toBe("النتيجة: 42");
  });
  it("does not deliver a successful reply for a failed turn", () => {
    expect(phoneReply({ text: "partial", running: false, stopped: false, error: "failed" })).toBe("");
  });
  it("does not deliver cancelled or still-running turns", () => {
    expect(phoneReply({ text: "partial", running: false, stopped: true, error: null })).toBe("");
    expect(phoneReply({ text: "partial", running: true, stopped: false, error: null })).toBe("");
  });
});
