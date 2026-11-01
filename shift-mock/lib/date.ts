import type { DateStr, Minutes, MonthStr } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");

export function toDateStr(d: Date): DateStr {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(s: DateStr): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayStr(): DateStr {
  return toDateStr(new Date());
}

export function addDays(s: DateStr, days: number): DateStr {
  const d = parseDate(s);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function diffDays(a: DateStr, b: DateStr): number {
  return Math.round((parseDate(a).getTime() - parseDate(b).getTime()) / 86400000);
}

export function monthOf(s: DateStr): MonthStr {
  return s.slice(0, 7);
}

export function addMonths(m: MonthStr, n: number): MonthStr {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function daysInMonth(m: MonthStr): DateStr[] {
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(y, mo, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${m}-${pad(i + 1)}`);
}

const WEEK = ["日", "月", "火", "水", "木", "金", "土"];
export function weekdayJa(s: DateStr): string {
  return WEEK[parseDate(s).getDay()];
}
export function weekdayIndex(s: DateStr): number {
  return parseDate(s).getDay();
}

/** "11/3(月)" */
export function formatDateJa(s: DateStr): string {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`;
}

export function formatMonthJa(m: MonthStr): string {
  const [y, mo] = m.split("-").map(Number);
  return `${y}年${mo}月`;
}

/** 600 → "10:00"。24時以降は "25:00" のように表記 */
export function fmtMin(m: Minutes): string {
  return `${Math.floor(m / 60)}:${pad(m % 60)}`;
}

export function fmtRange(start: Minutes, end: Minutes): string {
  return `${fmtMin(start)}〜${fmtMin(end)}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}
