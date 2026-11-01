import type { Assignment, ID, Minutes, OpenSlot } from "@/lib/types";

export type RowItem = { kind: "assignment"; a: Assignment } | { kind: "open"; o: OpenSlot };

const span = (i: RowItem) => (i.kind === "assignment" ? i.a : i.o);

/** 重なる配置を段(レーン)に振り分ける */
export function layoutLanes(items: RowItem[]): { item: RowItem; lane: number }[] {
  const sorted = [...items].sort((x, y) => span(x).start - span(y).start);
  const laneEnds: Minutes[] = [];
  return sorted.map((item) => {
    const s = span(item);
    let lane = laneEnds.findIndex((end) => end <= s.start);
    if (lane < 0) {
      lane = laneEnds.length;
      laneEnds.push(s.end);
    } else laneEnds[lane] = s.end;
    return { item, lane };
  });
}

export type Warning = "double" | "interval" | "outside";

export const WARNING_LABEL: Record<Warning, string> = {
  double: "同じスタッフが時間重複",
  interval: "入替インターバル不足",
  outside: "希望時間外",
};

/** 配置ごとの注意事項 */
export function computeWarnings(
  assignments: Assignment[],
  intervalMinutes: number,
  windowsOf: (staffId: ID) => { start: Minutes; end: Minutes }[],
): Map<ID, Warning[]> {
  const out = new Map<ID, Warning[]>();
  const add = (id: ID, w: Warning) => {
    const l = out.get(id) ?? [];
    if (!l.includes(w)) l.push(w);
    out.set(id, l);
  };
  for (const a of assignments) {
    for (const b of assignments) {
      if (a.id === b.id) continue;
      if (a.staffId === b.staffId && a.start < b.end && b.start < a.end) add(a.id, "double");
      if (a.roomId === b.roomId && a.staffId !== b.staffId && a.start < b.end + intervalMinutes && b.start < a.end + intervalMinutes)
        add(a.id, "interval");
    }
    const ws = windowsOf(a.staffId);
    if (!ws.some((w) => w.start <= a.start && a.end <= w.end)) add(a.id, "outside");
  }
  return out;
}
