import { describe, expect, it, vi } from "vitest";
import { settleRoutineRun } from "./routineSettlement.server";
describe("routine delivery", () => {
  it("commits reply and next schedule in one transaction", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await settleRoutineRun({ rpc }, "run", "42", [], "routine", false, "2026-11-16T12:05:00Z");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("finish_routine_run", { p_run: "run", p_text: "42", p_metadata: { routine_id: "routine", transcript: [] }, p_waiting: false, p_next: "2026-11-16T12:05:00Z" });
  });
  it("does not report an uncommitted completion as success", async () => {
    await expect(settleRoutineRun({ rpc: vi.fn().mockResolvedValue({ data: false, error: null }) }, "run", "42", [], "routine", false, "next")).rejects.toThrow("atomically");
  });
  it("rejects empty final replies without saving", async () => {
    const rpc = vi.fn();
    await expect(settleRoutineRun({ rpc }, "run", " ", [], "routine", false, "next")).rejects.toThrow("no completed answer");
    expect(rpc).not.toHaveBeenCalled();
  });
});