import { describe, expect, it } from "vitest";
import { isStalledJob, stalledJobNote } from "./jobHealth";

const now = Date.parse("2026-11-15T08:00:00Z");
describe("background task health", () => {
  it("treats a running task silent for over 4 minutes as stopped", () => {
    expect(isStalledJob({ status: "running", updated_at: "2026-11-15T07:55:00Z" }, now)).toBe(true);
  });
  it("keeps a task with a recent heartbeat running", () => {
    expect(isStalledJob({ status: "running", updated_at: "2026-11-15T07:58:00Z" }, now)).toBe(false);
  });
  it("never touches finished tasks", () => {
    expect(isStalledJob({ status: "completed", updated_at: "2026-11-15T06:00:00Z" }, now)).toBe(false);
  });
  it("writes the stop note in the task's language", () => {
    expect(stalledJobNote("إنشاء متجر كتب")).toMatch(/كمل/);
    expect(stalledJobNote("Build a store")).toMatch(/continue/);
  });
});
