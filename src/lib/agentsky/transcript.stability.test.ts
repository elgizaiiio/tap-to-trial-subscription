import { describe, expect, it } from "vitest";
import { buildTranscript } from "./transcript";

describe("single active agent turn", () => {
  it("keeps separate progress messages while reconciling chunks of the same message", () => {
    const turns = buildTranscript([
      { id: "first", type: "agent.message", parts: [{ type: "text", text: "Checking ", stream_id: "one" }] },
      { id: "first-chunk", type: "agent.message", parts: [{ type: "text", text: "the page.", stream_id: "one" }] },
      { id: "second", type: "agent.message", parts: [{ type: "text", text: "Found the result.", stream_id: "two" }] },
    ], "en", false);
    const turn = turns.find((t) => t.type === "agent");
    expect(turn?.type === "agent" ? turn.messages : []).toEqual(["Checking the page.", "Found the result."]);
  });
  it("retains structured social results through the saved transcript", () => {
    const data = { items: [{ platform: "instagram", kind: "reel", title: "Example", url: "https://instagram.com/reel/123", likes: 42 }] };
    const turns = buildTranscript([{ id: "result", type: "agent.tool_result", part: { type: "tool_result", call_id: "apify1", tool_name: "apify_results", status: "ok", result: JSON.stringify({ type: "ceyo.widget", widget: "social_results", data }) } }], "en", false);
    expect(turns.flatMap((turn) => turn.type === "agent" ? turn.cards : [])).toContainEqual({ kind: "widget", id: "apify1", name: "social_results", data });
  });
  it("does not display internal continuation events", () => {
    const turns = buildTranscript([
      { id: "goal", type: "user.message", content: [{ type: "text", text: "Upload my repository" }] },
      { id: "approval", type: "user.message", internal: true, content: [{ type: "text", text: "I approved the GitHub action. Continue." }] },
    ], "en", false);
    expect(turns.filter((t) => t.type === "user")).toHaveLength(1);
    expect(turns[0]).toMatchObject({ text: "Upload my repository" });
  });
  it("retains an owner document reference from the save_file result", () => {
    const turns = buildTranscript([{ id: "result", type: "agent.tool_result", part: { type: "tool_result", call_id: "save1", tool_name: "save_file", status: "ok", result: JSON.stringify({ type: "ceyo.file", id: "doc1", name: "report.txt" }) } }], "en", false);
    expect(turns.flatMap((turn) => turn.type === "agent" ? turn.cards : [])).toContainEqual({ kind: "file", id: "doc1", name: "report.txt" });
  });
  it("retains saved message pins and their database ids", () => {
    const turns = buildTranscript([
      { id: "user-1", type: "user.message", pinned: true, content: [{ type: "text", text: "Keep this" }] },
      { id: "run-1", type: "session.status_running", messageId: "database-message-1", pinned: true },
      { id: "answer-1", type: "agent.message", parts: [{ type: "text", text: "Pinned answer", stream_id: "answer" }] },
    ], "en", false);
    expect(turns[0]).toMatchObject({ type: "user", id: "user-1", pinned: true });
    expect(turns[1]).toMatchObject({ type: "agent", messageId: "database-message-1", pinned: true, text: "Pinned answer" });
  });
  it("closes the earlier thinking segment when a user steers the same run", () => {
    const turns = buildTranscript([
      { id: "user1", type: "user.message", content: [{ type: "text", text: "Research" }] },
      { id: "run1", type: "session.status_running" },
      { id: "thought1", type: "agent.reasoning", part: { type: "reasoning", text: "Checking", stream_id: "r" } },
      { id: "user2", type: "user.message", content: [{ type: "text", text: "Actually stop" }] },
      { id: "thought2", type: "agent.reasoning", part: { type: "reasoning", text: "Adjusting", stream_id: "r2" } },
    ], "en", true);
    expect(turns.filter((t) => t.type === "agent" && t.running)).toHaveLength(1);
    expect(turns.filter((t) => t.type === "agent").flatMap((t) => t.type === "agent" ? t.steps.filter((s) => s.status === "active") : [])).toHaveLength(1);
  });
});