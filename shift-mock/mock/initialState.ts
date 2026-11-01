// アプリの初期データ一式を組み立てる(初回起動時・「デモデータを初期化」時に実行)
import { autoAssign } from "@/lib/autoAssign";
import { addDays, addMonths, daysInMonth, monthOf } from "@/lib/date";
import { computeMetrics } from "@/lib/metrics";
import { createRng } from "@/lib/rng";
import { DEFAULT_SCORE_ITEMS } from "@/lib/score";
import { windowsForDate } from "@/lib/requests";
import type {
  AbsenceReport, AdminUser, AlertSetting, Area, Assignment, DateStr, Fine, FinePayment, Handover, Notice,
  OpenSlot, OperationLog, Room, RoomReport, ScoreItem, SecuritySettings, ShiftRequest, Staff, Store,
} from "@/lib/types";
import { getAttendanceRecords, staffProfile, DEMO_STAFF_ID } from "./attendance";
import { AREAS, ROOMS, STORES } from "./master";
import { ADMINS, STAFF } from "./people";

export interface DataState {
  seededOn: DateStr;
  stores: Store[];
  areas: Area[];
  rooms: Room[];
  staff: Staff[];
  admins: AdminUser[];
  requests: ShiftRequest[];
  assignments: Assignment[];
  openSlots: OpenSlot[];
  absences: AbsenceReport[];
  roomReports: RoomReport[];
  notices: Notice[];
  handovers: Handover[];
  fines: Fine[];
  finePayments: FinePayment[];
  scoreItems: ScoreItem[];
  alertSettings: AlertSetting[];
  logs: OperationLog[];
  security: SecuritySettings;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** 写真のダミー(SVG の dataURL) */
export function placeholderPhoto(label: string, hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="hsl(${hue},25%,82%)"/><rect x="20" y="20" width="200" height="140" rx="8" fill="hsl(${hue},20%,72%)"/><text x="120" y="96" font-size="18" text-anchor="middle" fill="#334" font-family="sans-serif">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function buildRequests(today: DateStr): ShiftRequest[] {
  const thisMonth = monthOf(today);
  const nextMonth = addMonths(thisMonth, 1);
  const out: ShiftRequest[] = [];
  STAFF.forEach((s, idx) => {
    const p = staffProfile(s.id);
    const store = STORES.find((st) => st.id === s.storeId)!;
    const bands = store.settings.timeBands;
    for (const month of [thisMonth, nextMonth]) {
      const isNext = month === nextMonth;
      const rng = createRng(5000 + idx * 7 + (isNext ? 1 : 0));
      // 翌月分は約 7 割が提出済み。デモ用スタッフは未提出にしておく
      const submitted = isNext ? s.id !== DEMO_STAFF_ID && rng.chance(0.7) : true;
      const entries: ShiftRequest["entries"] = [];
      if (submitted) {
        for (const date of daysInMonth(month)) {
          if (!rng.chance(p.perWeek / 7)) continue;
          const main = rng.chance(0.7) ? p.bandBias : rng.pick(bands).id;
          entries.push({ date, bandId: main });
          if (rng.chance(0.15)) {
            const i = bands.findIndex((b) => b.id === main);
            const adj = bands[i + 1] ?? bands[i - 1];
            if (adj) entries.push({ date, bandId: adj.id });
          }
        }
      }
      out.push({
        id: `${s.id}_${month}`,
        storeId: s.storeId,
        staffId: s.id,
        month,
        entries,
        submittedAt: submitted ? new Date(`${addMonths(month, -1)}-${String(rng.int(1, 15)).padStart(2, "0")}T21:00:00`).toISOString() : undefined,
      });
    }
  });
  return out;
}

export function buildInitialState(today: DateStr): DataState {
  const records = getAttendanceRecords(today);
  const metrics = computeMetrics(STAFF.map((s) => s.id), records, today, 182, DEFAULT_SCORE_ITEMS);
  const requests = buildRequests(today);
  const reqByStaff = new Map(requests.map((r) => [r.id, r]));

  // 今日から 3 日後までは確定済みの配置を作っておく(4 日後以降は自動仮組みのデモ用に空ける)
  const assignments: Assignment[] = [];
  let seq = 0;
  for (const store of STORES) {
    const areas = AREAS.filter((a) => a.storeId === store.id);
    const rooms = ROOMS.filter((r) => r.storeId === store.id).map((r) => ({
      id: r.id,
      areaId: r.areaId,
      areaOrder: areas.find((a) => a.id === r.areaId)!.order,
      order: r.order,
    }));
    const staff = STAFF.filter((s) => s.storeId === store.id);
    for (let d = 0; d <= 3; d++) {
      const date = addDays(today, d);
      const candidates = staff.flatMap((s) =>
        windowsForDate(reqByStaff.get(`${s.id}_${monthOf(date)}`), date, store.settings.timeBands).map((w) => ({
          staffId: s.id,
          score: metrics.get(s.id)!.score,
          homeAreaId: s.homeAreaId,
          fixedRoomId: s.fixedRoomId,
          ...w,
        })),
      );
      const result = autoAssign({
        rooms,
        candidates,
        existing: [],
        intervalMinutes: store.settings.roomSwapIntervalMinutes,
        open: store.settings.openTime,
        close: store.settings.closeTime,
      });
      for (const p of result.placements) {
        assignments.push({ id: `as${++seq}`, storeId: store.id, date, status: "confirmed", ...p });
      }
    }
  }

  // デモ用スタッフには必ず近日の確定シフトを入れる
  const demoRoom = ROOMS.find((r) => r.storeId === "st1" && !assignments.some((a) => a.roomId === r.id && a.date === addDays(today, 2) && a.start < 1140 && 840 < a.end));
  if (demoRoom && !assignments.some((a) => a.staffId === DEMO_STAFF_ID && a.date >= today)) {
    assignments.push({ id: `as${++seq}`, storeId: "st1", date: addDays(today, 2), roomId: demoRoom.id, staffId: DEMO_STAFF_ID, start: 840, end: 1140, status: "confirmed" });
  }

  // 空き枠: 各店舗で数日先の空いている部屋×時間帯を公開しておく
  const openSlots: OpenSlot[] = [];
  const rng = createRng(4242);
  for (const store of STORES) {
    const rooms = ROOMS.filter((r) => r.storeId === store.id);
    for (let d = 1; d <= 6; d++) {
      const date = addDays(today, d);
      let made = 0;
      for (let tries = 0; tries < 20 && made < 2; tries++) {
        const room = rng.pick(rooms);
        const band = rng.pick(store.settings.timeBands);
        const busy = assignments.some(
          (a) => a.roomId === room.id && a.date === date && a.start < band.end && band.start < a.end,
        );
        const dup = openSlots.some((o) => o.roomId === room.id && o.date === date && o.start < band.end && band.start < o.end);
        if (busy || dup) continue;
        openSlots.push({ id: `os-${store.id}-${d}-${made}`, storeId: store.id, date, roomId: room.id, start: band.start, end: band.end });
        made++;
      }
    }
  }

  const now = new Date();
  const iso = (daysAgo: number, h = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
  };

  const notices: Notice[] = STORES.flatMap((s) => [
    { id: `n-${s.id}-1`, storeId: s.id, title: "年末年始のシフト希望について", body: "12/28〜1/3 のシフト希望は通常より早めの提出をお願いします。出勤できる方は備考欄にご記入ください。", showOnLogin: true, createdAt: iso(1) },
    { id: `n-${s.id}-2`, storeId: s.id, title: "備品の置き場所変更", body: "タオル類のストックを各フロアの倉庫に移動しました。補充時はフロア倉庫から取り出してください。", showOnLogin: false, createdAt: iso(4) },
    { id: `n-${s.id}-3`, storeId: s.id, title: "入退室報告の写真について", body: "写真が暗いと確認できないため、照明を点けてから撮影してください。", showOnLogin: false, createdAt: iso(9) },
  ]);

  const handovers: Handover[] = [
    { id: "h1", storeId: "st1", staffId: DEMO_STAFF_ID, body: "先日はシーツ交換のフォローありがとうございました。次回出勤時に新しいチェック表の使い方を5分ほど説明します。", createdAt: iso(1, 18), read: false },
    { id: "h2", storeId: "st1", staffId: DEMO_STAFF_ID, body: "制服のサイズ交換ができました。事務所でお受け取りください。", createdAt: iso(3, 12), read: true },
    { id: "h3", storeId: "st1", staffId: "st1-s002", body: "鍵の返却を忘れずにお願いします。", createdAt: iso(2), read: false },
  ];

  const fines: Fine[] = [
    { id: "f1", staffId: DEMO_STAFF_ID, amount: 3000, reason: "無断遅刻(30分以上)", date: addDays(today, -40) },
    { id: "f2", staffId: DEMO_STAFF_ID, amount: 2000, reason: "備品破損", date: addDays(today, -12) },
  ];
  const finePayments: FinePayment[] = [{ id: "fp1", staffId: DEMO_STAFF_ID, amount: 1500, date: addDays(today, -20) }];
  STAFF.filter((s) => staffProfile(s.id).sameDayP > 0.06).slice(0, 12).forEach((s, i) => {
    fines.push({ id: `f-x${i}`, staffId: s.id, amount: 5000, reason: "当日欠勤", date: addDays(today, -(10 + i * 3)) });
    if (i % 2 === 0) finePayments.push({ id: `fp-x${i}`, staffId: s.id, amount: 2000, date: addDays(today, -(5 + i)) });
  });

  const absences: AbsenceReport[] = [
    { id: "ab1", storeId: "st1", staffId: "st1-s007", date: today, reason: "発熱のため", createdAt: iso(0, 8), acknowledged: false },
    { id: "ab2", storeId: "st1", staffId: "st1-s015", date: addDays(today, 1), reason: "家族の用事", createdAt: iso(1, 20), acknowledged: true },
  ];

  // 過去の入退室報告(ダミー写真)
  const roomReports: RoomReport[] = [];
  const pastRooms = ROOMS.filter((r) => r.storeId === "st1").slice(0, 6);
  pastRooms.forEach((room, i) => {
    for (const kind of ["enter", "exit"] as const) {
      const staff = STAFF.filter((s) => s.storeId === "st1")[i * 3 + 1];
      roomReports.push({
        id: `rr-${room.id}-${kind}`,
        storeId: "st1",
        roomId: room.id,
        staffId: staff.id,
        date: addDays(today, -(i % 3)),
        kind,
        photos: room.photoSpots.flatMap((sp) =>
          Array.from({ length: sp.count }, (_, k) => ({ spotId: sp.id, index: k, dataUrl: placeholderPhoto(`${room.name} ${sp.label}${sp.count > 1 ? k + 1 : ""}`, (i * 50 + (kind === "exit" ? 20 : 0)) % 360) })),
        ),
        checks: Object.fromEntries(room.checklist.map((c, ci) => [c.id, !(i === 2 && kind === "exit" && ci === 4)])),
        note: i === 2 && kind === "exit" ? "水回りの排水が遅いです。確認お願いします。" : "",
        createdAt: iso(i % 3, kind === "enter" ? 11 : 15),
      });
    }
  });

  const alertSettings: AlertSetting[] = [
    { staffId: "default", minMonthlyShifts: 4, maxSameDayAbsences: 2 },
    { staffId: "st1-s010", minMonthlyShifts: 8, maxSameDayAbsences: 1 },
  ];

  const logs: OperationLog[] = [
    { id: "lg0", at: iso(2, 9), actorId: "owner", actorName: "本部 オーナー", role: "owner", storeId: "st1", action: "店舗設定を変更", detail: "中央店: 提出期限日 20日" },
    { id: "lg1", at: iso(1, 17), actorId: "ad01", actorName: ADMINS[1].name, role: "admin", storeId: "st1", action: "確定シフトを公開", detail: "中央店 翌日分" },
  ];

  return {
    seededOn: today,
    stores: clone(STORES),
    areas: clone(AREAS),
    rooms: clone(ROOMS),
    staff: clone(STAFF),
    admins: clone(ADMINS),
    requests,
    assignments,
    openSlots,
    absences,
    roomReports,
    notices,
    handovers,
    fines,
    finePayments,
    scoreItems: clone(DEFAULT_SCORE_ITEMS),
    alertSettings,
    logs,
    security: { sessionTimeoutMinutes: 30 },
  };
}
