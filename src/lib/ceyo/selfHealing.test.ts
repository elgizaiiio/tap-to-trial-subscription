import { describe, expect, it } from "vitest";
import { compactMessages, createFailureTracker } from "./selfHealing";

describe("self healing", () => {
  it("gives up after 3 identical failures", () => {
    const t = createFailureTracker();
    expect(t.record("run_code", { code: "x" }, false).giveUp).toBe(false);
    expect(t.record("run_code", { code: "x" }, false).giveUp).toBe(false);
    expect(t.record("run_code", { code: "x" }, false).giveUp).toBe(true);
  });
  it("resets after success", () => {
    const t = createFailureTracker();
    t.record("a", {}, false); t.record("a", {}, false); t.record("a", {}, true);
    expect(t.record("a", {}, false).attempt).toBe(1);
  });
  it("shortens old tool outputs but keeps recent ones", () => {
    const msgs = Array.from({ length: 10 }, (_, i) => ({ role: "tool", tool_call_id: String(i), content: "x".repeat(10_000) }));
    compactMessages(msgs, 70_000, 6);
    expect(msgs[0].content!.length).toBeLessThan(1000);
    expect(msgs[9].content!.length).toBe(10_000);
  });
});
import { looksLikeFakeToolCall, looksLikeRefusal } from "./selfHealing";
describe("doer guards", () => {
  it("detects tool calls written as text", () => {
    expect(looksLikeFakeToolCall('```json\n{"action": "navigate", "url": "https://web.telegram.org"}\n```')).toBe(true);
    expect(looksLikeFakeToolCall('<tool_call>{"x":1}</tool_call>')).toBe(true);
    expect(looksLikeFakeToolCall('{"name": "telegram_bot", "arguments": {}}', ["telegram_bot"])).toBe(true);
    expect(looksLikeFakeToolCall("Your bot is live at https://t.me/example_bot")).toBe(false);
  });
  it("detects refusals and manual instructions", () => {
    expect(looksLikeRefusal("I can't access Telegram from here.")).toBe(true);
    expect(looksLikeRefusal("للأسف لا أستطيع تشغيل البوت")).toBe(true);
    expect(looksLikeRefusal("You need to deploy this Flask app on Heroku.")).toBe(true);
    expect(looksLikeRefusal("Done — your bot replies to /start now.")).toBe(false);
  });
});

import { looksLikeTechnicalAsk } from "./selfHealing";
describe("looksLikeTechnicalAsk", () => {
  it("catches asking an everyday user for chat_id or API steps", () => {
    expect(looksLikeTechnicalAsk("برجاء مشاركة الـ `chat_id` أو توضيح مكان وجود الرسائل")).toBe(true);
    expect(looksLikeTechnicalAsk("Please provide the chat_id of the group so I can call getUpdates.")).toBe(true);
  });
  it("leaves normal answers and plain questions alone", () => {
    expect(looksLikeTechnicalAsk("Here are your 5 newest messages.")).toBe(false);
    expect(looksLikeTechnicalAsk("محتاج أعرف تحب الرد يكون رسمي ولا ودّي؟")).toBe(false);
  });
});

import { blockedPageNote } from "./selfHealing";
describe("blockedPageNote", () => {
  it("flags anti-bot pages that came back as successful reads", () => {
    expect(blockedPageNote("Just a moment... Enable JavaScript and cookies to continue")).not.toBeNull();
    expect(blockedPageNote('{"text":"Access Denied\\nYou don\'t have permission to access"}')).not.toBeNull();
  });
  it("ignores normal pages", () => {
    expect(blockedPageNote("iPhone 16 Pro 128GB — 54,999 EGP. Free delivery.")).toBeNull();
  });
});
