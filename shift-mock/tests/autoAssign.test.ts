import { describe, expect, it } from "vitest";
import { autoAssign, type AutoAssignInput, type AutoAssignRoom } from "../lib/autoAssign";

const H = (h: number) => h * 60;

const rooms: AutoAssignRoom[] = [
  { id: "A1", areaId: "A", areaOrder: 0, order: 0 },
  { id: "A2", areaId: "A", areaOrder: 0, order: 1 },
  { id: "B1", areaId: "B", areaOrder: 1, order: 0 },
];

const base = (over: Partial<AutoAssignInput>): AutoAssignInput => ({
  rooms,
  candidates: [],
  existing: [],
  intervalMinutes: 30,
  open: H(10),
  close: H(24),
  ...over,
});

const roomOf = (r: ReturnType<typeof autoAssign>, staffId: string) =>
  r.placements.find((p) => p.staffId === staffId)?.roomId;

describe("autoAssign", () => {
  it("固定部屋のスタッフはスコアが低くても固定部屋に優先して入る", () => {
    const r = autoAssign(
      base({
        rooms: [rooms[0]],
        candidates: [
          { staffId: "high", score: 9.5, homeAreaId: "A", start: H(10), end: H(15) },
          { staffId: "fixed", score: 3.0, homeAreaId: "A", fixedRoomId: "A1", start: H(10), end: H(15) },
        ],
      }),
    );
    expect(roomOf(r, "fixed")).toBe("A1");
    expect(r.unassigned).toEqual([{ staffId: "high", reason: "no_room" }]);
  });

  it("部屋が足りないときはスコアの高い順に入る", () => {
    const r = autoAssign(
      base({
        rooms: [rooms[0], rooms[1]],
        candidates: [
          { staffId: "s3", score: 3, homeAreaId: "A", start: H(10), end: H(15) },
          { staffId: "s9", score: 9, homeAreaId: "A", start: H(10), end: H(15) },
          { staffId: "s6", score: 6, homeAreaId: "A", start: H(10), end: H(15) },
        ],
      }),
    );
    expect(roomOf(r, "s9")).toBe("A1");
    expect(roomOf(r, "s6")).toBe("A2");
    expect(roomOf(r, "s3")).toBeUndefined();
  });

  it("主担当エリアの部屋を優先する(他エリアに空きがあっても)", () => {
    const r = autoAssign(
      base({
        candidates: [{ staffId: "b", score: 5, homeAreaId: "B", start: H(12), end: H(18) }],
      }),
    );
    expect(roomOf(r, "b")).toBe("B1");
  });

  it("主担当エリアが埋まっていれば他エリアの部屋に回す", () => {
    const r = autoAssign(
      base({
        candidates: [
          { staffId: "b1", score: 8, homeAreaId: "B", start: H(12), end: H(18) },
          { staffId: "b2", score: 7, homeAreaId: "B", start: H(12), end: H(18) },
        ],
      }),
    );
    expect(roomOf(r, "b1")).toBe("B1");
    expect(roomOf(r, "b2")).toBe("A1");
  });

  it("同じ部屋の入れ替えにはインターバルを空ける", () => {
    const input = base({
      rooms: [rooms[0]],
      candidates: [
        { staffId: "early", score: 9, homeAreaId: "A", start: H(10), end: H(14) },
        { staffId: "late", score: 8, homeAreaId: "A", start: H(14), end: H(18) },
      ],
    });
    const withInterval = autoAssign(input);
    expect(roomOf(withInterval, "early")).toBe("A1");
    expect(roomOf(withInterval, "late")).toBeUndefined();

    const noInterval = autoAssign({ ...input, intervalMinutes: 0 });
    expect(roomOf(noInterval, "late")).toBe("A1");

    const shifted = autoAssign({
      ...input,
      candidates: [input.candidates[0], { ...input.candidates[1], start: H(14) + 30 }],
    });
    expect(roomOf(shifted, "late")).toBe("A1");
  });

  it("確定済みの配置とは重ねない(同じスタッフの二重配置もしない)", () => {
    const r = autoAssign(
      base({
        rooms: [rooms[0], rooms[1]],
        existing: [{ staffId: "x", roomId: "A1", start: H(10), end: H(20) }],
        candidates: [
          { staffId: "x", score: 9, homeAreaId: "A", start: H(12), end: H(16) },
          { staffId: "y", score: 5, homeAreaId: "A", start: H(12), end: H(16) },
        ],
      }),
    );
    expect(r.unassigned).toContainEqual({ staffId: "x", reason: "already_assigned" });
    expect(roomOf(r, "y")).toBe("A2");
  });

  it("営業時間外の希望は切り詰め、完全に外なら配置しない", () => {
    const r = autoAssign(
      base({
        candidates: [
          { staffId: "p", score: 5, homeAreaId: "A", start: H(8), end: H(12) },
          { staffId: "q", score: 5, homeAreaId: "A", start: H(6), end: H(9) },
        ],
      }),
    );
    expect(r.placements.find((p) => p.staffId === "p")).toMatchObject({ start: H(10), end: H(12) });
    expect(r.unassigned).toContainEqual({ staffId: "q", reason: "outside_hours" });
  });
});
