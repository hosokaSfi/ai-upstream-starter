// 過去 1 年分の出勤・遅刻・欠勤記録をシード固定の乱数で生成する。
// 量が多い(約 2 万件)ので localStorage には保存せず、必要時にメモリ上で生成する。
import { createRng } from "@/lib/rng";
import { addDays, weekdayIndex } from "@/lib/date";
import type { AttendanceRecord, DateStr, ID } from "@/lib/types";
import { STAFF } from "./people";

export interface StaffProfile {
  /** 週あたりの出勤希望日数 */
  perWeek: number;
  lateP: number;
  absentP: number;
  sameDayP: number;
  /** 直近 1 か月で出勤頻度が落ちている */
  declining: boolean;
  /** 直近 1 か月で当日欠勤が続いている */
  recentSameDay: boolean;
  /** よく選ぶ時間帯 */
  bandBias: "early" | "middle" | "late";
}

export const DEMO_STAFF_ID = "st1-s001";

const profileCache = new Map<ID, StaffProfile>();

export function staffProfile(staffId: ID): StaffProfile {
  const hit = profileCache.get(staffId);
  if (hit) return hit;
  let seed = 0;
  for (const ch of staffId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rng = createRng(seed);
  const tier = rng.next();
  const p: StaffProfile = {
    perWeek: rng.range(1.2, 5),
    lateP: tier < 0.2 ? rng.range(0.08, 0.18) : rng.range(0, 0.05),
    absentP: rng.range(0, 0.06),
    sameDayP: tier > 0.93 ? rng.range(0.12, 0.22) : tier > 0.85 ? rng.range(0.05, 0.12) : rng.range(0, 0.03),
    declining: rng.chance(0.07),
    recentSameDay: rng.chance(0.05),
    bandBias: rng.pick(["early", "middle", "late"] as const),
  };
  if (staffId === DEMO_STAFF_ID) {
    Object.assign(p, { perWeek: 4, lateP: 0.03, absentP: 0.02, sameDayP: 0.01, declining: false, recentSameDay: false, bandBias: "middle" });
  }
  profileCache.set(staffId, p);
  return p;
}

let cache: { today: DateStr; records: AttendanceRecord[] } | null = null;

export function getAttendanceRecords(today: DateStr): AttendanceRecord[] {
  if (cache?.today === today) return cache.records;
  const records: AttendanceRecord[] = [];
  STAFF.forEach((s, idx) => {
    const p = staffProfile(s.id);
    const rng = createRng(1000 + idx);
    for (let d = 365; d >= 1; d--) {
      const date = addDays(today, -d);
      if (date < s.joinedAt) continue;
      const recent = d <= 30;
      const weekendBoost = [0, 6].includes(weekdayIndex(date)) ? 1.2 : 1;
      const perWeek = recent && p.declining ? p.perWeek * 0.15 : p.perWeek;
      if (!rng.chance((perWeek / 7) * weekendBoost)) continue;
      const sameDayP = recent && p.recentSameDay ? 0.35 : p.sameDayP;
      const r = rng.next();
      let status: AttendanceRecord["status"] = "present";
      if (r < sameDayP) status = "sameDayAbsent";
      else if (r < sameDayP + p.absentP) status = "absent";
      else if (r < sameDayP + p.absentP + p.lateP) status = "late";
      records.push({ staffId: s.id, date, status });
    }
  });
  cache = { today, records };
  return records;
}
