import { describe, expect, it } from "vitest";
import { botTimelineIds } from "./botTimeline";
describe("one continuing bot timeline", () => {
  const rows = [
    { id: "later", bot_id: "ceyo", group_id: null, created_at: "2026-11-16" },
    { id: "first", bot_id: "ceyo", group_id: null, created_at: "2026-11-15" },
    { id: "other", bot_id: "helper", group_id: null, created_at: "2026-11-14" },
    { id: "channel", bot_id: "ceyo", group_id: null, created_at: "2026-11-13" },
    { id: "group", bot_id: "ceyo", group_id: "team", created_at: "2026-11-12" },
  ];
  it("includes every old app thread in chronological order for the same bot", () => {
    expect(botTimelineIds(rows, "ceyo", null, new Set(["channel"]))).toEqual(["first", "later"]);
  });
  it("keeps the group's history separate", () => {
    expect(botTimelineIds(rows, "ceyo", "team", new Set())).toEqual(["group"]);
  });
});