/** A running task saves a heartbeat while it works; silence means its worker was stopped. */
export const JOB_SILENCE_LIMIT_MS = 4 * 60_000;

export function isStalledJob(job: { status: string; updated_at: string }, now = Date.now()): boolean {
  if (job.status !== "running" && job.status !== "queued") return false;
  return now - new Date(job.updated_at).getTime() > JOB_SILENCE_LIMIT_MS;
}

/** Plain note for the chat when a task stopped; written in the task's own language. */
export function stalledJobNote(goal: string): string {
  return /[\u0600-\u06FF]/.test(goal)
    ? "المهمة دي وقفت في النص ومكملتش. ابعتلي «كمل» وهكملها هنا قدامك من آخر نقطة."
    : "This task stopped before it finished. Send “continue” and I’ll finish it right here from where it stopped.";
}
