import type { AttendanceRecord, DateStr, ID } from "./types";
import { addDays } from "./date";

export interface StaffStats {
  staffId: ID;
  /** 期間内のシフト数(= 希望が通って入る予定だった回数) */
  requested: number;
  worked: number;
  late: number;
  absent: number;
  sameDayAbsent: number;
  attendanceRate: number;
  lateRate: number;
  absenceRate: number;
  sameDayAbsenceRate: number;
}

export type PeriodKey = "1m" | "6m" | "1y";
export const PERIODS: { key: PeriodKey; label: string; days: number }[] = [
  { key: "1m", label: "直近1か月", days: 30 },
  { key: "6m", label: "半年", days: 182 },
  { key: "1y", label: "1年", days: 365 },
];

export function emptyStats(staffId: ID): StaffStats {
  return {
    staffId,
    requested: 0,
    worked: 0,
    late: 0,
    absent: 0,
    sameDayAbsent: 0,
    attendanceRate: 0,
    lateRate: 0,
    absenceRate: 0,
    sameDayAbsenceRate: 0,
  };
}

/** from <= date <= to の記録をスタッフ別に集計 */
export function computeStats(
  records: AttendanceRecord[],
  from: DateStr,
  to: DateStr,
): Map<ID, StaffStats> {
  const map = new Map<ID, StaffStats>();
  for (const r of records) {
    if (r.date < from || r.date > to) continue;
    let s = map.get(r.staffId);
    if (!s) {
      s = emptyStats(r.staffId);
      map.set(r.staffId, s);
    }
    s.requested++;
    if (r.status === "present") s.worked++;
    else if (r.status === "late") {
      s.worked++;
      s.late++;
    } else if (r.status === "absent") s.absent++;
    else s.sameDayAbsent++;
  }
  for (const s of map.values()) {
    const n = s.requested || 1;
    s.attendanceRate = s.worked / n;
    s.lateRate = s.worked ? s.late / s.worked : 0;
    s.absenceRate = (s.absent + s.sameDayAbsent) / n;
    s.sameDayAbsenceRate = s.sameDayAbsent / n;
  }
  return map;
}

export function periodRange(today: DateStr, days: number): { from: DateStr; to: DateStr } {
  return { from: addDays(today, -days), to: addDays(today, -1) };
}
