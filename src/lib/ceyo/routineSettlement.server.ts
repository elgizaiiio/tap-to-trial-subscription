import type { LoopEvent } from "./agentLoop.server";

/** One persisted transaction owns delivery, run completion and the next schedule. */
export async function settleRoutineRun(db: { rpc: (name: "finish_routine_run", args: { p_run: string; p_text: string; p_metadata: unknown; p_waiting: boolean; p_next: string }) => PromiseLike<{ data: unknown; error: unknown }> }, runId: string, text: string, transcript: LoopEvent[], routineId: string, waiting: boolean, next: string) {
  if (!text.trim()) throw new Error("Task returned no completed answer");
  const { data, error } = await db.rpc("finish_routine_run", { p_run: runId, p_text: text, p_metadata: { routine_id: routineId, transcript }, p_waiting: waiting, p_next: next });
  if (error || data !== true) throw new Error("Could not atomically save routine completion");
}