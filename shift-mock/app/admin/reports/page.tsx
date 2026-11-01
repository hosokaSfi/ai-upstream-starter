"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateJa, formatDateTime, todayStr } from "@/lib/date";
import { useCurrentStore, useRoomMap, useStoreAreasRooms } from "@/lib/hooks";
import { useData } from "@/lib/store";

export default function ReportsPage() {
  return (
    <PermissionGate perm="reports">
      <Reports />
    </PermissionGate>
  );
}

function Reports() {
  const store = useCurrentStore();
  const groups = useStoreAreasRooms(store.id);
  const reports = useData((d) => d.roomReports);
  const staff = useData((d) => d.staff);
  const roomMap = useRoomMap();
  const [date, setDate] = useState("");
  const [roomId, setRoomId] = useState("");
  const [zoom, setZoom] = useState<{ src: string; label: string } | null>(null);

  const list = useMemo(
    () =>
      reports
        .filter((r) => r.storeId === store.id && (!date || r.date === date) && (!roomId || r.roomId === roomId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [reports, store.id, date, roomId],
  );

  return (
    <div>
      <PageHeader title="入退室報告の確認" description="部屋別・日付別に、撮影された写真とチェック結果を確認できます。" />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="日付" />
        <button className="text-primary text-sm underline" onClick={() => setDate(todayStr())}>今日</button>
        <button className="text-muted-foreground text-sm underline" onClick={() => setDate("")}>すべての日付</button>
        <NativeSelect value={roomId} onChange={(e) => setRoomId(e.target.value)} className="w-48">
          <option value="">すべての部屋</option>
          {groups.map((g) => (
            <optgroup key={g.area.id} label={g.area.name}>
              {g.rooms.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
        <span className="text-muted-foreground text-sm">{list.length}件</span>
      </div>

      {list.length === 0 && <p className="text-muted-foreground py-16 text-center text-sm">該当する報告はありません</p>}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {list.map((r) => {
          const room = roomMap.get(r.roomId);
          const items = room?.checklist ?? [];
          const ng = items.filter((c) => !r.checks[c.id]);
          return (
            <Card key={r.id} className={ng.length ? "border-amber-300" : undefined}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <Badge variant={r.kind === "enter" ? "secondary" : "default"}>{r.kind === "enter" ? "入室" : "退室"}</Badge>
                  {room?.areaName} / {room?.name ?? "(削除済み)"}
                  <span className="text-muted-foreground text-xs font-normal">{formatDateJa(r.date)}</span>
                </CardTitle>
                <p className="text-muted-foreground text-xs">
                  {staff.find((s) => s.id === r.staffId)?.name} ・ {formatDateTime(r.createdAt)}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-4 gap-1.5">
                  {r.photos.map((p) => {
                    const spot = room?.photoSpots.find((s) => s.id === p.spotId);
                    const label = `${spot?.label ?? "写真"}${(spot?.count ?? 1) > 1 ? p.index + 1 : ""}`;
                    return (
                      <button key={`${p.spotId}-${p.index}`} className="group relative aspect-[4/3] overflow-hidden rounded border" onClick={() => setZoom({ src: p.dataUrl, label })}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.dataUrl} alt={label} className="size-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 text-[10px] text-white">{label}</span>
                      </button>
                    );
                  })}
                </div>
                {ng.length === 0 ? (
                  <p className="flex items-center gap-1 text-sm text-emerald-700"><CheckCircle2 className="size-4" /> チェック {items.length}/{items.length} 完了</p>
                ) : (
                  <div className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                    <p className="flex items-center gap-1 font-medium"><AlertTriangle className="size-4" /> 未チェック {ng.length}件</p>
                    <p className="text-xs">{ng.map((c) => c.label).join("、")}</p>
                  </div>
                )}
                {r.note && <p className="bg-muted rounded-md p-2 text-sm">メモ: {r.note}</p>}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{zoom?.label}</DialogTitle>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {zoom && <img src={zoom.src} alt={zoom.label} className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
