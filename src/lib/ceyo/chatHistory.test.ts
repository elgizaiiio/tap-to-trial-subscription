import { describe, it, expect } from "vitest";
import { normalizeChatHistory } from "./chatHistory";
describe("chat history", () => {
  it("retains hidden approval context and actual results for continuation", () => {
    expect(normalizeChatHistory([
      { role: "user", content: "Continue", metadata: { internal: true } },
      { role: "assistant", content: "Action completed", metadata: { internal: true, action_result: "archive ready" } },
    ])).toEqual([{ role: "assistant", content: "Action completed\nResult: archive ready" }, { role: "user", content: "Continue" }]);
  });
  it("keeps the latest user goal last and removes internal speaker markers", () => {
    expect(normalizeChatHistory([{ role: "user", content: "Calculate 2+3" }, { role: "assistant", content: "[[speaker: Writer]]\nOld reply" }])).toEqual([{ role: "assistant", content: "Old reply" }, { role: "user", content: "Calculate 2+3" }]);
  });
  it("does not replay interrupted assistant work as a completed answer", () => {
    expect(normalizeChatHistory([{ role: "assistant", content: "interrupted", metadata: { incomplete: true } }])).toEqual([]);
  });
});
import { it as it2, expect as expect2 } from "vitest";
it2("sends photos of the newest user message as image parts", async () => {
  const { normalizeChatHistory } = await import("./chatHistory");
  const out = normalizeChatHistory([{ role: "user", content: "what is this", metadata: { images: ["data:image/jpeg;base64,AAA"] } }]);
  expect2(Array.isArray(out[0].content)).toBe(true);
  expect2((out[0].content as unknown as { type: string }[])[1].type).toBe("image_url");
});
