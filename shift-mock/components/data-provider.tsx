"use client";
// localStorage からの復元と、初回起動時のダミーデータ生成を行う。
// 完了するまで画面は描画しない(サーバー描画とのずれを避けるため)。
import { useEffect } from "react";
import { toast } from "sonner";
import { buildInitialState } from "@/mock/initialState";
import { todayStr } from "@/lib/date";
import { useAppStore } from "@/lib/store";

export function DataProvider({ children }: { children: React.ReactNode }) {
  const hydrated = useAppStore((s) => s.hydrated);

  useEffect(() => {
    void Promise.resolve(useAppStore.persist.rehydrate()).then(() => {
      if (!useAppStore.getState().data) {
        useAppStore.setState({ data: buildInitialState(todayStr()) });
      }
      useAppStore.setState({ hydrated: true });
    });
    const onQuota = () => toast.error("端末の保存容量が不足しています。デモデータを初期化してください。");
    window.addEventListener("storage-quota", onQuota);
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    return () => window.removeEventListener("storage-quota", onQuota);
  }, []);

  if (!hydrated) {
    return (
      <div className="text-muted-foreground flex min-h-dvh items-center justify-center text-sm" aria-busy="true">
        読み込み中…
      </div>
    );
  }
  return <>{children}</>;
}
