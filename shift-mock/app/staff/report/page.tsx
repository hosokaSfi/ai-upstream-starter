"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Camera, CheckCircle2, ImagePlus, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fmtRange, todayStr } from "@/lib/date";
import { useMe, useRoomMap } from "@/lib/hooks";
import { resizeImage } from "@/lib/image";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import type { ID, RoomReportPhoto } from "@/lib/types";
import { placeholderPhoto } from "@/mock/initialState";
import { cn } from "@/lib/utils";

export default function RoomReportPage() {
  const me = useMe();
  const rooms = useData((d) => d.rooms);
  const assignments = useData((d) => d.assignments);
  const roomMap = useRoomMap();
  const today = todayStr();
  const todays = useMemo(
    () => assignments.filter((a) => a.staffId === me.id && a.date === today && a.status === "confirmed").sort((a, b) => a.start - b.start),
    [assignments, me.id, today],
  );
  const storeRooms = useMemo(() => rooms.filter((r) => r.storeId === me.storeId), [rooms, me.storeId]);

  const [roomId, setRoomId] = useState<ID>(todays[0]?.roomId ?? storeRooms[0]?.id ?? "");
  const [kind, setKind] = useState<"enter" | "exit">("enter");
  const [photos, setPhotos] = useState<RoomReportPhoto[]>([]);
  const [checks, setChecks] = useState<Record<ID, boolean>>({});
  const [note, setNote] = useState("");

  const room = storeRooms.find((r) => r.id === roomId) ?? storeRooms[0];
  // 撮影テンプレート(撮影箇所 × 枚数)を 1 枚ずつのステップに展開
  const steps = useMemo(
    () => (room?.photoSpots ?? []).flatMap((sp) => Array.from({ length: sp.count }, (_, i) => ({ spot: sp, index: i }))),
    [room],
  );
  const photoAt = (spotId: ID, index: number) => photos.find((p) => p.spotId === spotId && p.index === index);
  const current = steps.find((s) => !photoAt(s.spot.id, s.index));
  const done = steps.filter((s) => photoAt(s.spot.id, s.index)).length;

  const reset = () => {
    setPhotos([]);
    setChecks({});
    setNote("");
  };

  const onFile = async (spotId: ID, index: number, file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await resizeImage(file);
      setPhotos((ps) => [...ps.filter((p) => !(p.spotId === spotId && p.index === index)), { spotId, index, dataUrl }]);
    } catch {
      toast.error("画像を読み込めませんでした");
    }
  };

  if (!room) return <p className="text-muted-foreground p-6 text-sm">部屋が登録されていません</p>;
  const label = (s: { spot: { label: string; count: number }; index: number }) => `${s.spot.label}${s.spot.count > 1 ? ` ${s.index + 1}枚目` : ""}`;

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={kind} onValueChange={(v) => { setKind(v as "enter" | "exit"); reset(); }}>
        <TabsList className="h-12 w-full">
          <TabsTrigger value="enter" className="text-base">入室報告</TabsTrigger>
          <TabsTrigger value="exit" className="text-base">退室報告</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="grid gap-1.5">
        <NativeSelect value={room.id} onChange={(e) => { setRoomId(e.target.value); reset(); }} className="w-full [&_select]:h-12 [&_select]:text-base">
          {storeRooms.map((r) => (
            <option key={r.id} value={r.id}>
              {roomMap.get(r.id)?.areaName} / {r.name}
              {todays.some((a) => a.roomId === r.id) ? `(本日 ${todays.filter((a) => a.roomId === r.id).map((a) => fmtRange(a.start, a.end)).join(",")})` : ""}
            </option>
          ))}
        </NativeSelect>
      </div>

      {/* 撮影ステップ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><Camera className="size-4" /> 写真 {done}/{steps.length}</span>
            <button
              className="text-muted-foreground text-xs underline"
              onClick={() => setPhotos(steps.map((s, i) => ({ spotId: s.spot.id, index: s.index, dataUrl: placeholderPhoto(`${room.name} ${label(s)}`, (i * 60) % 360) })))}
            >
              デモ: ダミー写真で埋める
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="bg-muted h-2 overflow-hidden rounded-full">
            <div className="bg-primary h-full transition-all" style={{ width: `${steps.length ? (done / steps.length) * 100 : 0}%` }} />
          </div>
          {current ? (
            <label className="border-primary/50 bg-primary/5 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center">
              <ImagePlus className="text-primary size-10" />
              <span className="text-muted-foreground text-xs">次の撮影 ({done + 1}/{steps.length})</span>
              <span className="text-xl font-bold">{label(current)}</span>
              <span className="bg-primary text-primary-foreground mt-1 inline-flex h-12 items-center rounded-lg px-6 font-semibold">タップして撮影</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => { void onFile(current.spot.id, current.index, e.target.files?.[0]); e.target.value = ""; }}
              />
            </label>
          ) : (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="size-5" /> すべての写真を撮影しました
            </div>
          )}
          <div className="grid grid-cols-3 gap-2">
            {steps.map((s) => {
              const p = photoAt(s.spot.id, s.index);
              return (
                <label key={`${s.spot.id}-${s.index}`} className={cn("relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border text-center text-[11px]", !p && "bg-muted text-muted-foreground")}>
                  {p ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.dataUrl} alt={label(s)} className="absolute inset-0 size-full object-cover" />
                  ) : (
                    label(s)
                  )}
                  {p && (
                    <span className="absolute right-1 bottom-1 flex items-center gap-0.5 rounded bg-black/60 px-1 text-[10px] text-white">
                      <RotateCcw className="size-3" /> 撮り直す
                    </span>
                  )}
                  <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { void onFile(s.spot.id, s.index, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* チェックリスト */}
      {(["equipment", "cleaning"] as const).map((k) => {
        const items = room.checklist.filter((c) => c.kind === k);
        if (!items.length) return null;
        return (
          <Card key={k}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                {k === "equipment" ? "備品チェック" : "清掃チェック"}
                <Badge variant="secondary">{items.filter((c) => checks[c.id]).length}/{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {items.map((c) => (
                <label key={c.id} className="flex min-h-12 cursor-pointer items-center gap-3 border-b last:border-b-0">
                  <Checkbox checked={!!checks[c.id]} onCheckedChange={(v) => setChecks((x) => ({ ...x, [c.id]: v === true }))} className="size-6" />
                  <span className="text-base">{c.label}</span>
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="気づいたこと・不具合など(任意)" />

      <Button
        size="touch"
        disabled={!!current}
        onClick={() => {
          const missing = room.checklist.filter((c) => !checks[c.id]).length;
          if (missing && !confirm(`未チェックの項目が${missing}件あります。このまま送信しますか?`)) return;
          repo.roomReports.submit({ storeId: me.storeId, roomId: room.id, staffId: me.id, date: today, kind, photos, checks, note });
          toast.success(`${kind === "enter" ? "入室" : "退室"}報告を送信しました`);
          reset();
        }}
      >
        {current ? `あと${steps.length - done}枚 撮影してください` : `${kind === "enter" ? "入室" : "退室"}報告を送信`}
      </Button>
    </div>
  );
}
