import { describe, expect, it, beforeEach } from "vitest";
import { capturePhonePrompt, consumePhonePrompt } from "./assistantBridge";

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
