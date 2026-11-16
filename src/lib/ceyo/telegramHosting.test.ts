import { describe, expect, it } from "vitest";
import { fixedReply, publicHookOrigin, shouldAnswer, commandOf, type HostedBotConfig } from "./telegramHosting";

const cfg: HostedBotConfig = { v: 1, bot_id: 1, username: "demo_bot", mode: "ai_chat", start_text: "أهلا", commands: [{ command: "help", description: "Help", reply: "مساعدة" }] };

describe("hosted telegram bots", () => {
  it("answers /start and known commands with their fixed text", () => {
    expect(fixedReply(cfg, "/start")).toBe("أهلا");
    expect(fixedReply(cfg, "/help@demo_bot")).toBe("مساعدة");
  });
  it("leaves free text to the AI in ai_chat mode", () => {
    expect(fixedReply(cfg, "عامل ايه")).toBeNull();
  });
  it("uses the default reply for free text in auto_reply mode", () => {
    expect(fixedReply({ ...cfg, mode: "auto_reply", default_reply: "تمام" }, "hi")).toBe("تمام");
  });
  it("only answers commands or mentions in groups", () => {
    expect(shouldAnswer(cfg, "group", "hello all")).toBe(false);
    expect(shouldAnswer(cfg, "group", "@demo_bot hi")).toBe(true);
    expect(shouldAnswer(cfg, "private", "hello")).toBe(true);
  });
  it("maps the signed-in preview host to the public dev host", () => {
    expect(publicHookOrigin("https://id-preview--abc-123.lovable.app")).toBe("https://project--abc-123-dev.lovable.app");
    expect(publicHookOrigin("http://localhost:8080", "https://x.example/app")).toBe("https://x.example");
    expect(commandOf("not a command")).toBeNull();
  });
});
