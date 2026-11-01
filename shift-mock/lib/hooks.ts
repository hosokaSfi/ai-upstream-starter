"use client";
// 画面で使う派生データのフック。本番はここを Firestore の購読(onSnapshot)に置き換える。
import { useMemo } from "react";
import { getAttendanceRecords } from "@/mock/attendance";
import { addDays, todayStr } from "./date";
import { computeMetrics, type StaffMetric } from "./metrics";
import { computeStats, PERIODS, type PeriodKey } from "./stats";
import { useData, useSession } from "./store";
import type { AlertSetting, ID, Staff } from "./types";

export function useCurrentStore() {
  const { storeId } = useSession();
  const stores = useData((d) => d.stores);
  return stores.find((s) => s.id === storeId) ?? stores[0];
}

export function useStoreAreasRooms(storeId: ID) {
  const areas = useData((d) => d.areas);
  const rooms = useData((d) => d.rooms);
  return useMemo(() => {
    const as = areas.filter((a) => a.storeId === storeId).sort((a, b) => a.order - b.order);
    return as.map((area) => ({
      area,
      rooms: rooms.filter((r) => r.areaId === area.id).sort((a, b) => a.order - b.order),
    }));
  }, [areas, rooms, storeId]);
}

export function useStoreStaff(storeId: ID): Staff[] {
  const staff = useData((d) => d.staff);
  return useMemo(() => staff.filter((s) => s.storeId === storeId && s.active), [staff, storeId]);
}

export function useAttendance() {
  const today = todayStr();
  return useMemo(() => getAttendanceRecords(today), [today]);
}

/** スタッフごとの集計とスコア(期間・比重設定に追従して再計算) */
export function useMetrics(period: PeriodKey = "6m"): Map<ID, StaffMetric> {
  const staff = useData((d) => d.staff);
  const items = useData((d) => d.scoreItems);
  const records = useAttendance();
  const days = PERIODS.find((p) => p.key === period)!.days;
  return useMemo(
    () => computeMetrics(staff.map((s) => s.id), records, todayStr(), days, items),
    [staff, records, days, items],
  );
}

export interface StaffAlert {
  kind: "lowFrequency" | "sameDay";
  label: string;
}

/** 直近 30 日の出勤頻度低下・当日欠勤のアラート */
export function useAlerts(): Map<ID, StaffAlert[]> {
  const staff = useData((d) => d.staff);
  const settings = useData((d) => d.alertSettings);
  const records = useAttendance();
  return useMemo(() => {
    const today = todayStr();
    const recent = computeStats(records, addDays(today, -30), addDays(today, -1));
    const def: AlertSetting = settings.find((s) => s.staffId === "default") ?? { staffId: "default", minMonthlyShifts: 4, maxSameDayAbsences: 2 };
    const out = new Map<ID, StaffAlert[]>();
    for (const s of staff) {
      const th = settings.find((x) => x.staffId === s.id) ?? def;
      const st = recent.get(s.id);
      const worked = st?.worked ?? 0;
      const sameDay = st?.sameDayAbsent ?? 0;
      const list: StaffAlert[] = [];
      if (worked < th.minMonthlyShifts) list.push({ kind: "lowFrequency", label: `出勤頻度低下(${worked}回)` });
      if (sameDay >= th.maxSameDayAbsences) list.push({ kind: "sameDay", label: `当日欠勤${sameDay}回` });
      if (list.length) out.set(s.id, list);
    }
    return out;
  }, [staff, settings, records]);
}

export function useFineBalance(staffId: ID): number {
  const fines = useData((d) => d.fines);
  const pays = useData((d) => d.finePayments);
  return useMemo(
    () =>
      fines.filter((f) => f.staffId === staffId).reduce((a, f) => a + f.amount, 0) -
      pays.filter((p) => p.staffId === staffId).reduce((a, p) => a + p.amount, 0),
    [fines, pays, staffId],
  );
}

/** ログイン中のスタッフ本人 */
export function useMe(): Staff {
  const { staffId } = useSession();
  const staff = useData((d) => d.staff);
  return staff.find((s) => s.id === staffId) ?? staff[0];
}

export function useRoomMap() {
  const rooms = useData((d) => d.rooms);
  const areas = useData((d) => d.areas);
  return useMemo(() => {
    const areaName = new Map(areas.map((a) => [a.id, a.name]));
    return new Map(rooms.map((r) => [r.id, { ...r, areaName: areaName.get(r.areaId) ?? "" }]));
  }, [rooms, areas]);
}
