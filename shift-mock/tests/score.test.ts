import { describe, expect, it } from "vitest";
import { computeScore, DEFAULT_SCORE_ITEMS } from "../lib/score";
import { computeStats } from "../lib/stats";
import type { AttendanceRecord } from "../lib/types";

const recs = (staffId: string, statuses: AttendanceRecord["status"][]): AttendanceRecord[] =>
  statuses.map((status, i) => ({ staffId, date: `2026-10-${String(i + 1).padStart(2, "0")}`, status }));

describe("computeStats / computeScore", () => {
  it("出勤・遅刻・欠勤を集計する", () => {
    const s = computeStats(recs("a", ["present", "late", "absent", "sameDayAbsent"]), "2026-10-01", "2026-10-31").get("a")!;
    expect(s).toMatchObject({ requested: 4, worked: 2, late: 1, absent: 1, sameDayAbsent: 1 });
    expect(s.attendanceRate).toBe(0.5);
  });

  it("スコアは 0.1〜10 の範囲で、真面目な人ほど高い", () => {
    const good = computeStats(recs("g", Array(20).fill("present")), "2026-10-01", "2026-10-31").get("g")!;
    const bad = computeStats(recs("b", Array(20).fill("sameDayAbsent")), "2026-10-01", "2026-10-31").get("b")!;
    const sg = computeScore(good, DEFAULT_SCORE_ITEMS, 30);
    const sb = computeScore(bad, DEFAULT_SCORE_ITEMS, 30);
    expect(sg).toBe(10);
    expect(sb).toBeGreaterThanOrEqual(0.1);
    expect(sb).toBeLessThan(sg);
  });

  it("比重を変えるとスコアが変わる(当日欠勤の比重0なら影響しない)", () => {
    const s = computeStats(recs("c", [...Array(18).fill("present"), "sameDayAbsent", "sameDayAbsent"]), "2026-10-01", "2026-10-31").get("c")!;
    const only = (key: string) => DEFAULT_SCORE_ITEMS.map((i) => ({ ...i, weight: i.key === key ? 1 : 0 }));
    expect(computeScore(s, only("sameDayAbsenceRate"), 30)).toBeLessThan(computeScore(s, only("lateRate"), 30));
  });
});
