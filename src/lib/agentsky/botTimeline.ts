/** Stable app-thread selection. Channel threads never join the app timeline. */
export type TimelineThread = { id: string; bot_id: string | null; group_id: string | null; created_at: string };
export function botTimelineIds(rows: TimelineThread[], bot: string, group: string | null, channelIds: Set<string>): string[] {
  return rows.filter((row) => row.bot_id === bot && row.group_id === group && !channelIds.has(row.id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)).map((row) => row.id);
}