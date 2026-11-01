import type { DateStr, ID, ScoreItem } from "./types";
import type { AttendanceRecord } from "./types";
import { computeStats, emptyStats, periodRange, type StaffStats } from "./stats";
import { computeScore } from "./score";

export interface StaffMetric {
  stats: StaffStats;
  score: number;
}

export function computeMetrics(
  staffIds: ID[],
  records: AttendanceRecord[],
  today: DateStr,
  periodDays: number,
  items: ScoreItem[],
): Map<ID, StaffMetric> {
  const { from, to } = periodRange(today, periodDays);
  const stats = computeStats(records, from, to);
  const out = new Map<ID, StaffMetric>();
  for (const id of staffIds) {
    const s = stats.get(id) ?? emptyStats(id);
    out.set(id, { stats: s, score: computeScore(s, items, periodDays) });
  }
  return out;
}
