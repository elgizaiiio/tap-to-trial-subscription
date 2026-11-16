import { describe, expect, it, beforeEach } from "vitest";
import { capturePhonePrompt, consumePhonePrompt, phoneReply, takePhoneVoiceReply, phoneOption, phoneStatus } from "./assistantBridge";

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
  it("speaks once only for a sent assistant voice prompt", () => {
    capturePhonePrompt("https://app.ceyo.si/?ceyoVoice=1&ceyoSend=1&ceyoPrompt=hello");
    expect(consumePhonePrompt()?.voice).toBe(true);
    expect(takePhoneVoiceReply()).toBe(true);
    expect(takePhoneVoiceReply()).toBe(false);
  });
  it("does not request speech for a normal text prompt", () => {
    capturePhonePrompt("https://app.ceyo.si/?ceyoSend=1&ceyoPrompt=hello");
    consumePhonePrompt();
    expect(takePhoneVoiceReply()).toBe(false);
  });
});

describe("native controls", () => {
  it("keeps the Android method receiver and confirms both toggle values", () => {
    const native = { liveUpdate() {}, setOption(json: string) { expect(this).toBe(native); calls.push(JSON.parse(json)); }, status() { return JSON.stringify({ wake_on: false }); } };
    const calls: unknown[] = [];
    window.MegsyAndroid = native as unknown as typeof window.MegsyAndroid;
    expect(phoneOption("wake_on", true)).toBe(true);
    expect(phoneOption("car_on", true)).toBe(true);
    expect(calls).toEqual([{ key: "wake_on", on: true }, { key: "car_on", on: true }]);
    delete window.MegsyAndroid;
  });
  it("does not treat a rejected bridge as valid phone status", () => {
    window.MegsyAndroid = { status: () => "{}" } as unknown as typeof window.MegsyAndroid;
    expect(phoneStatus()).toBeNull();
    delete window.MegsyAndroid;
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
