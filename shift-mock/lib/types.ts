// データモデル(型定義)。本番は Firestore のコレクションにほぼ 1:1 で対応させる想定。
// 時刻は「その日の 0:00 からの分」(例 10:00 = 600)で扱う。日付は "YYYY-MM-DD"。

export type ID = string;
export type DateStr = string; // YYYY-MM-DD
export type MonthStr = string; // YYYY-MM
export type Minutes = number;

export type Role = "staff" | "admin" | "owner";

// ---------- 店舗・ブランド ----------
export interface Brand {
  id: ID;
  name: string;
}

/** シフト希望で選ぶ時間帯(早番・中番・遅番など)。店舗ごとに定義 */
export interface TimeBand {
  id: ID;
  label: string;
  start: Minutes;
  end: Minutes;
}

/** 店舗ごとにカスタムできる設定(将来の多店舗展開を想定) */
export interface StoreSettings {
  openTime: Minutes;
  closeTime: Minutes;
  slotMinutes: 30 | 60;
  /** 翌月分のシフト希望の提出期限(毎月 N 日 23:59) */
  submissionDeadlineDay: number;
  /** 同じ部屋でスタッフを入れ替えるときに空ける分数 */
  roomSwapIntervalMinutes: number;
  timeBands: TimeBand[];
}

export interface Store {
  id: ID;
  name: string;
  brandIds: ID[];
  settings: StoreSettings;
}

// ---------- エリア・部屋 ----------
export interface Area {
  id: ID;
  storeId: ID;
  name: string;
  order: number;
}

export type ChecklistKind = "equipment" | "cleaning";

export interface ChecklistItem {
  id: ID;
  label: string;
  kind: ChecklistKind;
}

/** 入退室報告の撮影箇所(例: 入口 1 枚、水回り 2 枚) */
export interface PhotoSpot {
  id: ID;
  label: string;
  count: number;
}

export interface Room {
  id: ID;
  storeId: ID;
  areaId: ID;
  name: string;
  order: number;
  checklist: ChecklistItem[];
  photoSpots: PhotoSpot[];
}

// ---------- 人 ----------
/** ブランドごとの別名義。Staff 1 : N BrandAlias */
export interface BrandAlias {
  id: ID;
  staffId: ID;
  brandId: ID;
  displayName: string;
}

export interface Staff {
  id: ID;
  storeId: ID;
  name: string;
  kana: string;
  aliases: BrandAlias[];
  /** 主に担当するエリア(自動仮組みの「エリア別」で使う) */
  homeAreaId: ID;
  /** 固定部屋(あれば自動仮組みで最優先) */
  fixedRoomId?: ID;
  joinedAt: DateStr;
  phone: string;
  active: boolean;
}

/** 権限の単位 = 管理画面 1 つ */
export type PermissionKey =
  | "board"
  | "staffList"
  | "score"
  | "alerts"
  | "rooms"
  | "roster"
  | "requests"
  | "reports"
  | "notices"
  | "sheets";

export interface AdminUser {
  id: ID;
  name: string;
  email: string;
  role: "admin" | "owner";
  storeIds: ID[];
  permissions: PermissionKey[];
  active: boolean;
}

// ---------- 勤怠実績 ----------
export type AttendanceStatus = "present" | "late" | "absent" | "sameDayAbsent";

/** 過去の出勤記録。absent = 事前連絡あり欠勤、sameDayAbsent = 当日欠勤 */
export interface AttendanceRecord {
  staffId: ID;
  date: DateStr;
  status: AttendanceStatus;
}

// ---------- シフト ----------
export interface ShiftRequestEntry {
  date: DateStr;
  bandId: ID;
}

/** スタッフ 1 人 × 1 か月分のシフト希望 */
export interface ShiftRequest {
  id: ID;
  storeId: ID;
  staffId: ID;
  month: MonthStr;
  entries: ShiftRequestEntry[];
  submittedAt?: string; // ISO。未提出なら undefined
}

export type AssignmentStatus = "draft" | "confirmed";

/** 配置(誰が・いつ・どの部屋に入るか)。draft = 自動仮組みの仮配置 */
export interface Assignment {
  id: ID;
  storeId: ID;
  date: DateStr;
  roomId: ID;
  staffId: ID;
  start: Minutes;
  end: Minutes;
  status: AssignmentStatus;
}

/** 空き枠。早い者順で取得、取得されたら takenBy が入り他の人からは消える */
export interface OpenSlot {
  id: ID;
  storeId: ID;
  date: DateStr;
  roomId: ID;
  start: Minutes;
  end: Minutes;
  takenBy?: ID;
  takenAt?: string;
}

export interface AbsenceReport {
  id: ID;
  storeId: ID;
  staffId: ID;
  date: DateStr;
  reason: string;
  createdAt: string;
  acknowledged: boolean;
}

// ---------- 入退室報告 ----------
export interface RoomReportPhoto {
  spotId: ID;
  index: number;
  /** モックでは縮小した dataURL。本番は Storage のパス */
  dataUrl: string;
}

export interface RoomReport {
  id: ID;
  storeId: ID;
  roomId: ID;
  staffId: ID;
  date: DateStr;
  kind: "enter" | "exit";
  photos: RoomReportPhoto[];
  checks: Record<ID, boolean>;
  note: string;
  createdAt: string;
}

// ---------- お知らせ・申し送り・罰金 ----------
export interface Notice {
  id: ID;
  storeId: ID;
  title: string;
  body: string;
  /** ログイン時にポップアップ表示するか */
  showOnLogin: boolean;
  createdAt: string;
}

/** 個別の申し送り(特定スタッフ宛) */
export interface Handover {
  id: ID;
  storeId: ID;
  staffId: ID;
  body: string;
  createdAt: string;
  read: boolean;
}

export interface Fine {
  id: ID;
  staffId: ID;
  amount: number;
  reason: string;
  date: DateStr;
}

export interface FinePayment {
  id: ID;
  staffId: ID;
  amount: number;
  date: DateStr;
}

// ---------- スコア・アラート ----------
export type ScoreItemKey =
  | "attendanceRate"
  | "lateRate"
  | "sameDayAbsenceRate"
  | "absenceRate"
  | "requestVolume";

export interface ScoreItem {
  key: ScoreItemKey;
  label: string;
  /** true = 値が高いほど良い */
  positive: boolean;
  weight: number; // 0〜10
}

export interface AlertSetting {
  staffId: ID; // "default" は全体の既定値
  /** 直近 30 日の出勤がこの回数未満なら「出勤頻度低下」 */
  minMonthlyShifts: number;
  /** 直近 30 日の当日欠勤がこの回数以上なら「当日欠勤」 */
  maxSameDayAbsences: number;
}

// ---------- 操作ログ ----------
export interface OperationLog {
  id: ID;
  at: string;
  actorId: ID;
  actorName: string;
  role: Role;
  storeId: ID;
  action: string;
  detail: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
}
