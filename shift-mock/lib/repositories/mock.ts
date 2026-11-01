"use client";
// Repositories のモック実装。Zustand ストア(localStorage 永続化)を読み書きし、操作ログも残す。
import { buildInitialState, type DataState } from "@/mock/initialState";
import { DEFAULT_SCORE_ITEMS } from "../score";
import { fmtRange, formatDateJa, todayStr } from "../date";
import { DEFAULT_SESSION, useAppStore } from "../store";
import type { ID, OperationLog, Role } from "../types";
import type { Repositories } from "./types";

const uid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const get = () => useAppStore.getState();
const data = () => get().data as DataState;

function setData(fn: (d: DataState) => Partial<DataState>) {
  useAppStore.setState((s) => ({ data: { ...(s.data as DataState), ...fn(s.data as DataState) } }));
}

function actor(): { id: ID; name: string; role: Role } {
  const { session } = get();
  const d = data();
  if (session.role === "staff") {
    const s = d.staff.find((x) => x.id === session.staffId);
    return { id: session.staffId, name: s?.name ?? "スタッフ", role: "staff" };
  }
  const a = d.admins.find((x) => x.id === (session.role === "owner" ? "owner" : session.adminId));
  return { id: a?.id ?? "?", name: a?.name ?? "管理者", role: session.role ?? "admin" };
}

function log(action: string, detail = "") {
  const a = actor();
  const entry: OperationLog = {
    id: uid("lg"),
    at: new Date().toISOString(),
    actorId: a.id,
    actorName: a.name,
    role: a.role,
    storeId: get().session.storeId,
    action,
    detail,
  };
  setData((d) => ({ logs: [entry, ...d.logs].slice(0, 500) }));
}

const roomName = (id: ID) => data().rooms.find((r) => r.id === id)?.name ?? id;
const staffName = (id: ID) => data().staff.find((s) => s.id === id)?.name ?? id;
const storeName = (id: ID) => data().stores.find((s) => s.id === id)?.name ?? id;

export const mockRepositories: Repositories = {
  auth: {
    login(role) {
      const session = get().session;
      useAppStore.setState({
        session: { ...session, role, adminId: role === "owner" ? "owner" : session.adminId === "owner" ? "ad01" : session.adminId, loginNoticeClosedAt: undefined },
      });
      // スタッフは自分の店舗に合わせる
      if (role === "staff") {
        const st = data().staff.find((s) => s.id === session.staffId);
        if (st) useAppStore.setState({ session: { ...get().session, storeId: st.storeId } });
      }
      log("ログイン", role === "staff" ? "スタッフ" : role === "admin" ? "管理者" : "オーナー");
    },
    logout() {
      log("ログアウト");
      useAppStore.setState({ session: { ...get().session, role: null } });
    },
    switchStore(storeId) {
      useAppStore.setState({ session: { ...get().session, storeId } });
    },
    switchStaff(staffId) {
      const st = data().staff.find((s) => s.id === staffId);
      useAppStore.setState({ session: { ...get().session, staffId, storeId: st?.storeId ?? get().session.storeId, loginNoticeClosedAt: undefined } });
    },
    switchAdmin(adminId) {
      useAppStore.setState({ session: { ...get().session, adminId } });
    },
    closeLoginNotice() {
      useAppStore.setState({ session: { ...get().session, loginNoticeClosedAt: new Date().toISOString() } });
    },
  },

  assignments: {
    create(a) {
      const created = { ...a, id: uid("as") };
      setData((d) => ({ assignments: [...d.assignments, created] }));
      log("配置を追加", `${formatDateJa(a.date)} ${roomName(a.roomId)} ${staffName(a.staffId)} ${fmtRange(a.start, a.end)}`);
      return created;
    },
    move(id, roomId, start) {
      const cur = data().assignments.find((a) => a.id === id);
      if (!cur) return;
      const len = cur.end - cur.start;
      setData((d) => ({ assignments: d.assignments.map((a) => (a.id === id ? { ...a, roomId, start, end: start + len } : a)) }));
      log("配置を移動", `${staffName(cur.staffId)}: ${roomName(cur.roomId)} → ${roomName(roomId)} ${fmtRange(start, start + len)}`);
    },
    updateTime(id, start, end) {
      const cur = data().assignments.find((a) => a.id === id);
      if (!cur) return;
      setData((d) => ({ assignments: d.assignments.map((a) => (a.id === id ? { ...a, start, end } : a)) }));
      log("配置の時間を変更", `${staffName(cur.staffId)} ${fmtRange(start, end)}`);
    },
    remove(id) {
      const cur = data().assignments.find((a) => a.id === id);
      setData((d) => ({ assignments: d.assignments.filter((a) => a.id !== id) }));
      if (cur) log("配置を外す", `${formatDateJa(cur.date)} ${roomName(cur.roomId)} ${staffName(cur.staffId)}`);
    },
    replaceDrafts(storeId, date, placements) {
      setData((d) => ({
        assignments: [
          ...d.assignments.filter((a) => !(a.storeId === storeId && a.date === date && a.status === "draft")),
          ...placements.map((p) => ({ ...p, id: uid("as"), storeId, date, status: "draft" as const })),
        ],
      }));
      log("自動仮組みを実行", `${storeName(storeId)} ${formatDateJa(date)} 仮配置 ${placements.length}件`);
    },
    confirmDrafts(storeId, date) {
      const n = data().assignments.filter((a) => a.storeId === storeId && a.date === date && a.status === "draft").length;
      setData((d) => ({
        assignments: d.assignments.map((a) =>
          a.storeId === storeId && a.date === date && a.status === "draft" ? { ...a, status: "confirmed" } : a,
        ),
      }));
      log("仮配置を確定", `${storeName(storeId)} ${formatDateJa(date)} ${n}件`);
      return n;
    },
    discardDrafts(storeId, date) {
      setData((d) => ({
        assignments: d.assignments.filter((a) => !(a.storeId === storeId && a.date === date && a.status === "draft")),
      }));
      log("仮配置を破棄", `${storeName(storeId)} ${formatDateJa(date)}`);
    },
  },

  openSlots: {
    publish(slot) {
      setData((d) => ({ openSlots: [...d.openSlots, { ...slot, id: uid("os") }] }));
      log("空き枠を公開", `${formatDateJa(slot.date)} ${roomName(slot.roomId)} ${fmtRange(slot.start, slot.end)}`);
    },
    take(slotId, staffId) {
      const slot = data().openSlots.find((o) => o.id === slotId);
      if (!slot || slot.takenBy) return false;
      setData((d) => ({
        openSlots: d.openSlots.map((o) => (o.id === slotId ? { ...o, takenBy: staffId, takenAt: new Date().toISOString() } : o)),
        assignments: [
          ...d.assignments,
          { id: uid("as"), storeId: slot.storeId, date: slot.date, roomId: slot.roomId, staffId, start: slot.start, end: slot.end, status: "confirmed" },
        ],
      }));
      log("空き枠を取得", `${formatDateJa(slot.date)} ${roomName(slot.roomId)} ${fmtRange(slot.start, slot.end)}`);
      return true;
    },
    remove(slotId) {
      setData((d) => ({ openSlots: d.openSlots.filter((o) => o.id !== slotId) }));
      log("空き枠を取り下げ", slotId);
    },
  },

  requests: {
    submit(staffId, storeId, month, entries) {
      const id = `${staffId}_${month}`;
      const rec = { id, staffId, storeId, month, entries, submittedAt: new Date().toISOString() };
      setData((d) => ({ requests: [...d.requests.filter((r) => r.id !== id), rec] }));
      log("シフト希望を提出", `${month} ${new Set(entries.map((e) => e.date)).size}日分`);
    },
  },

  absences: {
    report(r) {
      setData((d) => ({ absences: [{ ...r, id: uid("ab"), createdAt: new Date().toISOString(), acknowledged: false }, ...d.absences] }));
      log("急な休みを報告", `${formatDateJa(r.date)} ${r.reason}`);
    },
    acknowledge(id) {
      setData((d) => ({ absences: d.absences.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)) }));
      log("休み報告を確認", id);
    },
  },

  roomReports: {
    submit(r) {
      setData((d) => ({ roomReports: [{ ...r, id: uid("rr"), createdAt: new Date().toISOString() }, ...d.roomReports] }));
      log(r.kind === "enter" ? "入室報告" : "退室報告", `${roomName(r.roomId)} 写真${r.photos.length}枚`);
    },
  },

  comms: {
    addNotice(n) {
      setData((d) => ({ notices: [{ ...n, id: uid("n"), createdAt: new Date().toISOString() }, ...d.notices] }));
      log("お知らせを登録", n.title);
    },
    removeNotice(id) {
      const n = data().notices.find((x) => x.id === id);
      setData((d) => ({ notices: d.notices.filter((x) => x.id !== id) }));
      log("お知らせを削除", n?.title ?? id);
    },
    addHandover(storeId, staffId, body) {
      setData((d) => ({ handovers: [{ id: uid("h"), storeId, staffId, body, createdAt: new Date().toISOString(), read: false }, ...d.handovers] }));
      log("申し送りを登録", `${staffName(staffId)} 宛`);
    },
    markHandoverRead(id) {
      setData((d) => ({ handovers: d.handovers.map((h) => (h.id === id ? { ...h, read: true } : h)) }));
    },
    addFine(f) {
      setData((d) => ({ fines: [...d.fines, { ...f, id: uid("f") }] }));
      log("罰金を登録", `${staffName(f.staffId)} ${f.amount.toLocaleString()}円 ${f.reason}`);
    },
    addFinePayment(p) {
      setData((d) => ({ finePayments: [...d.finePayments, { ...p, id: uid("fp") }] }));
      log("罰金の支払いを登録", `${staffName(p.staffId)} ${p.amount.toLocaleString()}円`);
    },
    sendReminder(staffIds, month) {
      log("シフト希望の提出をリマインド", `${month} 未提出 ${staffIds.length}名`);
    },
  },

  settings: {
    setScoreWeight(key, weight) {
      setData((d) => ({ scoreItems: d.scoreItems.map((i) => (i.key === key ? { ...i, weight } : i)) }));
    },
    commitScoreWeights() {
      log("スコア比重を変更", data().scoreItems.map((i) => `${i.label}${i.weight}`).join(" / "));
    },
    resetScoreWeights() {
      setData(() => ({ scoreItems: DEFAULT_SCORE_ITEMS.map((i) => ({ ...i })) }));
      log("スコア比重を初期値に戻す");
    },
    upsertAlertSetting(s) {
      setData((d) => ({ alertSettings: [...d.alertSettings.filter((a) => a.staffId !== s.staffId), s] }));
      log("アラート閾値を設定", `${s.staffId === "default" ? "全体既定" : staffName(s.staffId)}: 月${s.minMonthlyShifts}回未満 / 当日欠勤${s.maxSameDayAbsences}回以上`);
    },
    removeAlertSetting(staffId) {
      setData((d) => ({ alertSettings: d.alertSettings.filter((a) => a.staffId !== staffId) }));
      log("個別アラート閾値を解除", staffName(staffId));
    },
    updateStoreSettings(storeId, patch) {
      setData((d) => ({ stores: d.stores.map((s) => (s.id === storeId ? { ...s, settings: { ...s.settings, ...patch } } : s)) }));
      log("店舗設定を変更", `${storeName(storeId)}: ${Object.keys(patch).join(", ")}`);
    },
    updateSecurity(patch) {
      setData((d) => ({ security: { ...d.security, ...patch } }));
      log("セキュリティ設定を変更", JSON.stringify(patch));
    },
  },

  rooms: {
    addArea(storeId, name) {
      const order = data().areas.filter((a) => a.storeId === storeId).length;
      setData((d) => ({ areas: [...d.areas, { id: uid("area"), storeId, name, order }] }));
      log("エリアを追加", name);
    },
    renameArea(id, name) {
      setData((d) => ({ areas: d.areas.map((a) => (a.id === id ? { ...a, name } : a)) }));
      log("エリア名を変更", name);
    },
    removeArea(id) {
      if (data().rooms.some((r) => r.areaId === id)) return false;
      setData((d) => ({ areas: d.areas.filter((a) => a.id !== id) }));
      log("エリアを削除", id);
      return true;
    },
    addRoom(storeId, areaId, name) {
      const id = uid("room");
      const order = data().rooms.filter((r) => r.areaId === areaId).length;
      setData((d) => ({
        rooms: [
          ...d.rooms,
          {
            id, storeId, areaId, name, order,
            checklist: [
              { id: `${id}-c1`, label: "備品の破損・不足なし", kind: "equipment" },
              { id: `${id}-c2`, label: "床の清掃", kind: "cleaning" },
            ],
            photoSpots: [{ id: `${id}-p1`, label: "入口", count: 1 }],
          },
        ],
      }));
      log("部屋を追加", name);
    },
    updateRoom(id, patch) {
      setData((d) => ({ rooms: d.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      log("部屋を編集", `${roomName(id)}: ${Object.keys(patch).join(", ")}`);
    },
    removeRoom(id) {
      const name = roomName(id);
      setData((d) => ({ rooms: d.rooms.filter((r) => r.id !== id), assignments: d.assignments.filter((a) => a.roomId !== id) }));
      log("部屋を削除", name);
    },
  },

  staff: {
    add(s) {
      const id = uid("stf");
      const staff = { ...s, id, aliases: s.aliases.map((a, i) => ({ ...a, id: `${id}-al${i + 1}`, staffId: id })) };
      setData((d) => ({ staff: [...d.staff, staff] }));
      log("スタッフを登録", s.name);
      return staff;
    },
    bulkImport(rows) {
      const created = rows.map((s, n) => {
        const id = uid(`stf${n}`);
        return { ...s, id, aliases: s.aliases.map((a, i) => ({ ...a, id: `${id}-al${i + 1}`, staffId: id })) };
      });
      setData((d) => ({ staff: [...d.staff, ...created] }));
      log("名簿を一括登録", `${created.length}名`);
      return created.length;
    },
    update(id, patch) {
      setData((d) => ({ staff: d.staff.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
      log("スタッフ情報を更新", `${staffName(id)}: ${Object.keys(patch).join(", ")}`);
    },
  },

  admins: {
    add(a) {
      setData((d) => ({ admins: [...d.admins, { ...a, id: uid("ad") }] }));
      log("管理者アカウントを発行", `${a.name} (${a.email})`);
    },
    update(id, patch) {
      const a = data().admins.find((x) => x.id === id);
      setData((d) => ({ admins: d.admins.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
      const what = patch.active === false ? "停止" : patch.active === true ? "再開" : patch.permissions ? "権限変更" : "更新";
      log(`管理者アカウントを${what}`, a?.name ?? id);
    },
  },

  sheets: {
    logExport(rows, range) {
      log("確定シフトを書き出し", `${range} ${rows}行`);
    },
    logImport(rows) {
      log("スプレッドシートを読み取り", `${rows}行`);
    },
  },

  resetDemo() {
    useAppStore.setState({ data: buildInitialState(todayStr()), session: { ...DEFAULT_SESSION } });
  },
};
