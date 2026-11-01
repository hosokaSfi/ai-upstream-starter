// データアクセス層のインターフェース。
// 画面はこのインターフェースだけを呼ぶ。モックは mock.ts(Zustand + localStorage)、
// 本番は firestore.ts を同じ形で実装して index.ts の 1 行を差し替える想定。
import type {
  AbsenceReport, AdminUser, AlertSetting, Assignment, BrandAlias, DateStr, Fine, FinePayment, ID,
  Minutes, MonthStr, Notice, OpenSlot, Role, Room, RoomReport, ScoreItemKey, SecuritySettings,
  ShiftRequestEntry, Staff, StoreSettings,
} from "../types";
import type { Block } from "../autoAssign";

export interface AuthRepository {
  /** モックは役割を選ぶだけ。本番は Firebase Auth + カスタムクレーム */
  login(role: Role): void;
  logout(): void;
  switchStore(storeId: ID): void;
  switchStaff(staffId: ID): void;
  switchAdmin(adminId: ID): void;
  closeLoginNotice(): void;
}

export interface AssignmentRepository {
  create(a: Omit<Assignment, "id">): Assignment;
  move(id: ID, roomId: ID, start: Minutes): void;
  updateTime(id: ID, start: Minutes, end: Minutes): void;
  remove(id: ID): void;
  /** 既存の仮配置を消して新しい仮配置を入れる */
  replaceDrafts(storeId: ID, date: DateStr, placements: Block[]): void;
  confirmDrafts(storeId: ID, date: DateStr): number;
  discardDrafts(storeId: ID, date: DateStr): void;
}

export interface OpenSlotRepository {
  publish(slot: Omit<OpenSlot, "id" | "takenBy" | "takenAt">): void;
  /** 早い者順。すでに取られていたら false(本番は Firestore トランザクション) */
  take(slotId: ID, staffId: ID): boolean;
  remove(slotId: ID): void;
}

export interface ShiftRequestRepository {
  submit(staffId: ID, storeId: ID, month: MonthStr, entries: ShiftRequestEntry[]): void;
}

export interface AbsenceRepository {
  report(r: Omit<AbsenceReport, "id" | "createdAt" | "acknowledged">): void;
  acknowledge(id: ID): void;
}

export interface RoomReportRepository {
  /** 本番は写真を Storage にアップロードしてパスを保存 */
  submit(r: Omit<RoomReport, "id" | "createdAt">): void;
}

export interface CommunicationRepository {
  addNotice(n: Omit<Notice, "id" | "createdAt">): void;
  removeNotice(id: ID): void;
  addHandover(storeId: ID, staffId: ID, body: string): void;
  markHandoverRead(id: ID): void;
  addFine(f: Omit<Fine, "id">): void;
  addFinePayment(p: Omit<FinePayment, "id">): void;
  /** シフト希望の未提出者へリマインド(本番は FCM プッシュ通知 / メール) */
  sendReminder(staffIds: ID[], month: MonthStr): void;
}

export interface SettingsRepository {
  setScoreWeight(key: ScoreItemKey, weight: number): void;
  /** スライダー操作の確定時に呼ぶ(履歴に残す) */
  commitScoreWeights(): void;
  resetScoreWeights(): void;
  upsertAlertSetting(s: AlertSetting): void;
  removeAlertSetting(staffId: ID): void;
  updateStoreSettings(storeId: ID, patch: Partial<StoreSettings>): void;
  updateSecurity(patch: Partial<SecuritySettings>): void;
}

export interface RoomRepository {
  addArea(storeId: ID, name: string): void;
  renameArea(id: ID, name: string): void;
  removeArea(id: ID): boolean;
  addRoom(storeId: ID, areaId: ID, name: string): void;
  updateRoom(id: ID, patch: Partial<Omit<Room, "id" | "storeId">>): void;
  removeRoom(id: ID): void;
}

export interface StaffRepository {
  add(s: Omit<Staff, "id" | "aliases"> & { aliases: Omit<BrandAlias, "id" | "staffId">[] }): Staff;
  bulkImport(rows: (Omit<Staff, "id" | "aliases"> & { aliases: Omit<BrandAlias, "id" | "staffId">[] })[]): number;
  update(id: ID, patch: Partial<Omit<Staff, "id">>): void;
}

export interface AdminRepository {
  add(a: Omit<AdminUser, "id">): void;
  update(id: ID, patch: Partial<Omit<AdminUser, "id">>): void;
}

export interface SheetsRepository {
  /** モック: 書き出し内容を返すだけ。本番は Google Sheets API(サーバー側)で書き込み */
  logExport(rows: number, range: string): void;
  logImport(rows: number): void;
}

export interface Repositories {
  auth: AuthRepository;
  assignments: AssignmentRepository;
  openSlots: OpenSlotRepository;
  requests: ShiftRequestRepository;
  absences: AbsenceRepository;
  roomReports: RoomReportRepository;
  comms: CommunicationRepository;
  settings: SettingsRepository;
  rooms: RoomRepository;
  staff: StaffRepository;
  admins: AdminRepository;
  sheets: SheetsRepository;
  /** デモ用: データを初期状態に戻す */
  resetDemo(): void;
}
