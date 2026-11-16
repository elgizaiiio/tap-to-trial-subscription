import { describe, expect, it, vi } from "vitest";
vi.mock("./cerebrasCompletion.server", () => ({ requestCerebrasChatCompletion: vi.fn(async () => new Response("ok")) }));
import { chatModelResponse } from "./chatModel.server";
import { requestCerebrasChatCompletion } from "./cerebrasCompletion.server";
import { modelsFor } from "@/lib/models/modelRouter";

describe("real chat model routing", () => {
  it("passes each chosen CoArena model chain through the chat adapter", async () => {
    for (const role of ["fast", "orchestrator", "web", "coding", "vision"] as const) {
      const signal = new AbortController().signal;
      const models = modelsFor(role);
      await chatModelResponse([{ role: "user", content: "hello" }], [], signal, models);
      expect(requestCerebrasChatCompletion).toHaveBeenLastCalledWith(expect.objectContaining({ stream: true }), signal, models);
    }
  });
});