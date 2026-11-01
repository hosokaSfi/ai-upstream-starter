import type { DateStr, ID, Minutes, ShiftRequest, TimeBand } from "./types";

/** ある日のシフト希望(時間帯の集合)を、重なる時間帯をまとめた出勤可能時間に変換 */
export function windowsForDate(
  req: ShiftRequest | undefined,
  date: DateStr,
  bands: TimeBand[],
): { start: Minutes; end: Minutes }[] {
  if (!req) return [];
  const ws = req.entries
    .filter((e) => e.date === date)
    .map((e) => bands.find((b) => b.id === e.bandId))
    .filter((b): b is TimeBand => !!b)
    .map((b) => ({ start: b.start, end: b.end }))
    .sort((a, b) => a.start - b.start);
  const merged: { start: Minutes; end: Minutes }[] = [];
  for (const w of ws) {
    const last = merged[merged.length - 1];
    if (last && w.start <= last.end) last.end = Math.max(last.end, w.end);
    else merged.push({ ...w });
  }
  return merged;
}

/** 提出期限(対象月の前月の deadlineDay 23:59:59) */
export function deadlineFor(month: string, deadlineDay: number): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 2, deadlineDay, 23, 59, 59);
}

export function requestKey(staffId: ID, month: string) {
  return `${staffId}_${month}`;
}
