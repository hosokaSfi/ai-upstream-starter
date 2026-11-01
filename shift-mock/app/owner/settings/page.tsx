"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtMin } from "@/lib/date";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import type { Store, StoreSettings, TimeBand } from "@/lib/types";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const pad = (m: number) => fmtMin(m).padStart(5, "0");
const hourOptions = Array.from({ length: 21 }, (_, i) => (i + 8) * 60); // 8:00〜28:00

export default function OwnerSettingsPage() {
  const stores = useData((d) => d.stores);
  const security = useData((d) => d.security);
  const [storeId, setStoreId] = useState(stores[0].id);
  const store = stores.find((s) => s.id === storeId)!;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="店舗・セキュリティ設定" description="店舗ごとに営業時間・時間帯の刻み・提出期限などを変えられます(多店舗展開を想定した設計)。" />
      <Tabs value={storeId} onValueChange={setStoreId}>
        <TabsList>
          {stores.map((s) => (<TabsTrigger key={s.id} value={s.id}>{s.name}</TabsTrigger>))}
        </TabsList>
      </Tabs>
      <StoreForm key={`${store.id}-${JSON.stringify(store.settings)}`} store={store} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" /> セキュリティ</CardTitle>
          <CardDescription>モックでは表示のみ(実際にはログアウトされません)</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label>セッションタイムアウト</Label>
            <NativeSelect value={security.sessionTimeoutMinutes} onChange={(e) => repo.settings.updateSecurity({ sessionTimeoutMinutes: Number(e.target.value) })} className="w-44">
              {[15, 30, 60, 120, 480].map((m) => (<option key={m} value={m}>{m < 60 ? `${m}分` : `${m / 60}時間`}</option>))}
            </NativeSelect>
          </div>
          <Badge variant="secondary">操作がない状態で {security.sessionTimeoutMinutes} 分経過すると自動ログアウト</Badge>
        </CardContent>
      </Card>
    </div>
  );
}

function StoreForm({ store }: { store: Store }) {
  const [s, setS] = useState<StoreSettings>(store.settings);
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setS((x) => ({ ...x, [k]: v }));
  const setBand = (i: number, patch: Partial<TimeBand>) => set("timeBands", s.timeBands.map((b, j) => (j === i ? { ...b, ...patch } : b)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{store.name} の設定</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="grid gap-1.5">
            <Label>開店</Label>
            <NativeSelect value={s.openTime} onChange={(e) => set("openTime", Number(e.target.value))}>
              {hourOptions.map((m) => (<option key={m} value={m}>{fmtMin(m)}</option>))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>閉店</Label>
            <NativeSelect value={s.closeTime} onChange={(e) => set("closeTime", Number(e.target.value))}>
              {hourOptions.map((m) => (<option key={m} value={m}>{fmtMin(m)}</option>))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>時間帯の刻み</Label>
            <NativeSelect value={s.slotMinutes} onChange={(e) => set("slotMinutes", Number(e.target.value) as 30 | 60)}>
              <option value={30}>30分</option>
              <option value={60}>60分</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>希望の提出期限</Label>
            <NativeSelect value={s.submissionDeadlineDay} onChange={(e) => set("submissionDeadlineDay", Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (<option key={d} value={d}>前月 {d}日</option>))}
            </NativeSelect>
          </div>
          <div className="grid gap-1.5">
            <Label>部屋の入替インターバル</Label>
            <NativeSelect value={s.roomSwapIntervalMinutes} onChange={(e) => set("roomSwapIntervalMinutes", Number(e.target.value))}>
              {[0, 15, 30, 45, 60].map((m) => (<option key={m} value={m}>{m}分</option>))}
            </NativeSelect>
          </div>
        </div>

        <div className="grid gap-2">
          <Label>シフト希望の時間帯</Label>
          {s.timeBands.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-center gap-2">
              <Input value={b.label} onChange={(e) => setBand(i, { label: e.target.value })} className="w-28" />
              <Input type="time" step={1800} value={pad(b.start)} onChange={(e) => setBand(i, { start: toMin(e.target.value) })} className="w-32" />
              〜
              <Input type="time" step={1800} value={pad(Math.min(b.end, 1439))} onChange={(e) => setBand(i, { end: toMin(e.target.value) || 1440 })} className="w-32" />
              <Button variant="ghost" size="icon" aria-label="時間帯を削除" disabled={s.timeBands.length <= 1} onClick={() => set("timeBands", s.timeBands.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="w-fit" onClick={() => set("timeBands", [...s.timeBands, { id: `band-${Date.now()}`, label: "新しい時間帯", start: s.openTime, end: s.openTime + 240 }])}>
            <Plus /> 時間帯を追加
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => {
              if (s.closeTime <= s.openTime) return toast.error("閉店は開店より後にしてください");
              repo.settings.updateStoreSettings(store.id, s);
              toast.success(`${store.name} の設定を保存しました`);
            }}
          >
            保存
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
