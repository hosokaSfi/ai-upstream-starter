// 自動仮組みロジック(簡易版)。UI やストアに依存しない純粋関数にしてテストしやすくしている。
//
// 優先順:
//   1. 固定部屋を持つスタッフを先に、その固定部屋へ配置
//   2. エリア別: エリアの並び順に、そのエリアを主担当とするスタッフを同エリアの部屋へ
//   3. 各段階の中ではスコアの高い順
//   4. 同じ部屋で前後のスタッフと入れ替わるときは intervalMinutes 以上空ける
//   最後に、主担当エリアに入れなかったスタッフをスコア順に空いている部屋へ回す。

import type { ID, Minutes } from "./types";

export interface AutoAssignRoom {
  id: ID;
  areaId: ID;
  /** エリアの並び順 */
  areaOrder: number;
  /** エリア内での部屋の並び順 */
  order: number;
}

export interface AutoAssignCandidate {
  staffId: ID;
  score: number;
  homeAreaId: ID;
  fixedRoomId?: ID;
  /** 出勤可能な時間(シフト希望の時間帯) */
  start: Minutes;
  end: Minutes;
}

export interface Block {
  staffId: ID;
  roomId: ID;
  start: Minutes;
  end: Minutes;
}

export interface AutoAssignInput {
  rooms: AutoAssignRoom[];
  candidates: AutoAssignCandidate[];
  /** すでに確定している配置(これとはぶつけない) */
  existing: Block[];
  intervalMinutes: number;
  open: Minutes;
  close: Minutes;
}

export type UnassignedReason = "no_room" | "already_assigned" | "outside_hours";

export interface AutoAssignResult {
  placements: Block[];
  unassigned: { staffId: ID; reason: UnassignedReason }[];
}

const byScoreDesc = (a: AutoAssignCandidate, b: AutoAssignCandidate) =>
  b.score - a.score || a.staffId.localeCompare(b.staffId);

export function autoAssign(input: AutoAssignInput): AutoAssignResult {
  const { intervalMinutes, open, close } = input;
  const rooms = [...input.rooms].sort((a, b) => a.areaOrder - b.areaOrder || a.order - b.order);
  const roomIds = new Set(rooms.map((r) => r.id));
  const blocks: Block[] = input.existing.map((b) => ({ ...b }));
  const placements: Block[] = [];
  const unassigned: AutoAssignResult["unassigned"] = [];

  const staffBusy = (staffId: ID, start: Minutes, end: Minutes) =>
    blocks.some((b) => b.staffId === staffId && b.start < end && start < b.end);

  // 同じ部屋の前後にインターバルを確保できるか
  const roomFree = (roomId: ID, start: Minutes, end: Minutes) =>
    blocks.every(
      (b) => b.roomId !== roomId || !(start < b.end + intervalMinutes && b.start < end + intervalMinutes),
    );

  const place = (c: { staffId: ID; start: Minutes; end: Minutes }, roomId: ID) => {
    const b = { staffId: c.staffId, roomId, start: c.start, end: c.end };
    blocks.push(b);
    placements.push(b);
  };

  // 前処理: 営業時間で切り詰め、既に入っているスタッフを除外
  const valid: AutoAssignCandidate[] = [];
  for (const raw of input.candidates) {
    const c = { ...raw, start: Math.max(raw.start, open), end: Math.min(raw.end, close) };
    if (c.end <= c.start) {
      unassigned.push({ staffId: c.staffId, reason: "outside_hours" });
    } else if (staffBusy(c.staffId, c.start, c.end)) {
      unassigned.push({ staffId: c.staffId, reason: "already_assigned" });
    } else {
      valid.push(c);
    }
  }

  const tryRooms = (c: AutoAssignCandidate, list: AutoAssignRoom[]) => {
    if (staffBusy(c.staffId, c.start, c.end)) return true; // 同一人物の別希望が先に入った
    const room = list.find((r) => roomFree(r.id, c.start, c.end));
    if (!room) return false;
    place(c, room.id);
    return true;
  };

  let pool: AutoAssignCandidate[] = [];

  // 1. 固定部屋
  const fixed = valid.filter((c) => c.fixedRoomId && roomIds.has(c.fixedRoomId)).sort(byScoreDesc);
  const others = valid.filter((c) => !(c.fixedRoomId && roomIds.has(c.fixedRoomId)));
  for (const c of fixed) {
    if (!tryRooms(c, rooms.filter((r) => r.id === c.fixedRoomId))) pool.push(c);
  }

  // 2. エリア別(エリア順)× スコア順
  const areaOrder = [...new Set(rooms.map((r) => r.areaId))];
  for (const areaId of areaOrder) {
    const areaRooms = rooms.filter((r) => r.areaId === areaId);
    for (const c of others.filter((o) => o.homeAreaId === areaId).sort(byScoreDesc)) {
      if (!tryRooms(c, areaRooms)) pool.push(c);
    }
  }
  pool.push(...others.filter((o) => !areaOrder.includes(o.homeAreaId)));

  // 3. 残りをスコア順に空いている部屋へ
  pool = pool.sort(byScoreDesc);
  for (const c of pool) {
    if (!tryRooms(c, rooms)) unassigned.push({ staffId: c.staffId, reason: "no_room" });
  }

  return { placements, unassigned };
}
