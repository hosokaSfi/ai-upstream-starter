"use client";
// モックのデータ保存先。Zustand + persist(localStorage)。
// 画面からは直接書き換えず、lib/repositories 経由で操作する(本番は Firestore に差し替え)。
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import type { DataState } from "@/mock/initialState";
import type { ID, Role } from "./types";

export interface Session {
  role: Role | null;
  /** スタッフとして入ったときの本人 */
  staffId: ID;
  /** 管理者・オーナーとして入ったときの本人 */
  adminId: ID;
  storeId: ID;
  /** ログイン時お知らせを閉じた時刻 */
  loginNoticeClosedAt?: string;
}

export interface AppState {
  hydrated: boolean;
  data: DataState | null;
  session: Session;
}

export const DEFAULT_SESSION: Session = {
  role: null,
  staffId: "st1-s001",
  adminId: "ad01",
  storeId: "st1",
};

// 容量オーバー(写真の保存しすぎ等)でも落ちないようにする
const safeStorage: StateStorage = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      window.dispatchEvent(new CustomEvent("storage-quota"));
    }
  },
  removeItem: (k) => localStorage.removeItem(k),
};

export const STORAGE_KEY = "shift-mock-v1";

export const useAppStore = create<AppState>()(
  persist(
    (): AppState => ({
      hydrated: false,
      data: null,
      session: DEFAULT_SESSION,
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      skipHydration: true,
      partialize: (s) => ({ data: s.data, session: s.session }),
    },
  ),
);

/** data が必ずある前提で使うフック(DataProvider 配下でのみ使う) */
export function useData<T>(selector: (d: DataState) => T): T {
  return useAppStore((s) => selector(s.data as DataState));
}

export function useSession(): Session {
  return useAppStore((s) => s.session);
}
