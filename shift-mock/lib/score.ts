import type { ScoreItem, ScoreItemKey } from "./types";
import type { StaffStats } from "./stats";

export const DEFAULT_SCORE_ITEMS: ScoreItem[] = [
  { key: "attendanceRate", label: "出勤率", positive: true, weight: 5 },
  { key: "lateRate", label: "遅刻", positive: false, weight: 3 },
  { key: "sameDayAbsenceRate", label: "当日欠勤", positive: false, weight: 6 },
  { key: "absenceRate", label: "欠勤(事前連絡あり)", positive: false, weight: 2 },
  { key: "requestVolume", label: "出勤希望の多さ", positive: true, weight: 3 },
];

/** 1 か月あたりこの回数出勤希望があれば「希望の多さ」を満点とする */
const VOLUME_FULL_PER_MONTH = 20;

/** 各項目を 0〜1 の「良さ」に正規化 */
export function itemGoodness(key: ScoreItemKey, s: StaffStats, periodDays: number): number {
  switch (key) {
    case "attendanceRate":
      return s.requested ? s.attendanceRate : 0;
    case "lateRate":
      return 1 - Math.min(s.lateRate / 0.1, 1);
    case "sameDayAbsenceRate":
      return 1 - Math.min(s.sameDayAbsenceRate / 0.08, 1);
    case "absenceRate":
      return 1 - Math.min((s.absenceRate - s.sameDayAbsenceRate) / 0.12, 1);
    case "requestVolume":
      return Math.min(s.requested / ((VOLUME_FULL_PER_MONTH * periodDays) / 30), 1);
  }
}

/** スコア 0.1〜10(小数1桁)。比重がすべて 0 なら 5.0 */
export function computeScore(s: StaffStats, items: ScoreItem[], periodDays: number): number {
  const total = items.reduce((a, i) => a + i.weight, 0);
  if (total <= 0) return 5;
  const g = items.reduce((a, i) => a + i.weight * itemGoodness(i.key, s, periodDays), 0) / total;
  return Math.round((0.1 + 9.9 * g) * 10) / 10;
}

export type ScoreBand = "high" | "good" | "mid" | "low";
export function scoreBand(score: number): ScoreBand {
  if (score >= 8) return "high";
  if (score >= 6) return "good";
  if (score >= 4) return "mid";
  return "low";
}

/** スコア帯ごとのチップ配色(Tailwind クラス) */
export const SCORE_BAND_STYLE: Record<ScoreBand, { chip: string; dot: string; label: string }> = {
  high: { chip: "bg-emerald-100 text-emerald-900 border-emerald-300", dot: "bg-emerald-500", label: "8.0以上" },
  good: { chip: "bg-sky-100 text-sky-900 border-sky-300", dot: "bg-sky-500", label: "6.0〜7.9" },
  mid: { chip: "bg-amber-100 text-amber-900 border-amber-300", dot: "bg-amber-500", label: "4.0〜5.9" },
  low: { chip: "bg-rose-100 text-rose-900 border-rose-300", dot: "bg-rose-500", label: "4.0未満" },
};
