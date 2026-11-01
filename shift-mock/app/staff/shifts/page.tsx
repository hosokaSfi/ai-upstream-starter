"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck, Hand, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtRange, formatDateJa, todayStr } from "@/lib/date";
import { useMe, useRoomMap } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import type { OpenSlot } from "@/lib/types";

export default function MyShiftsPage() {
  const me = useMe();
  const assignments = useData((d) => d.assignments);
  const openSlots = useData((d) => d.openSlots);
  const roomMap = useRoomMap();
  const [taking, setTaking] = useState<OpenSlot | null>(null);
  const today = todayStr();

  const mine = useMemo(
    () =>
      assignments
        .filter((a) => a.staffId === me.id && a.status === "confirmed" && a.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start),
    [assignments, me.id, today],
  );
  // 自分の店舗の、まだ誰も取っていない空き枠(取られたら全員の一覧から消える)
  const available = useMemo(
    () =>
      openSlots
        .filter((o) => o.storeId === me.storeId && !o.takenBy && o.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start),
    [openSlots, me.storeId, today],
  );
  const conflicts = (o: OpenSlot) => mine.some((a) => a.date === o.date && a.start < o.end && o.start < a.end);

  return (
    <Tabs defaultValue="mine">
      <TabsList className="w-full">
        <TabsTrigger value="mine">
          <CalendarCheck className="size-4" /> 確定シフト
        </TabsTrigger>
        <TabsTrigger value="open">
          <Hand className="size-4" /> 空き枠
          {available.length > 0 && <Badge className="ml-1 h-5 px-1.5">{available.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="mine" className="flex flex-col gap-2">
        {mine.length === 0 && <p className="text-muted-foreground py-10 text-center text-sm">確定したシフトはまだありません</p>}
        {mine.map((a) => (
          <Card key={a.id} className="py-3">
            <CardContent className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary flex w-16 flex-col items-center rounded-lg py-1.5">
                <span className="text-lg leading-tight font-bold">{formatDateJa(a.date).split("(")[0]}</span>
                <span className="text-xs">({formatDateJa(a.date).split("(")[1]}</span>
              </div>
              <div className="flex-1">
                <div className="text-lg font-semibold tabular-nums">{fmtRange(a.start, a.end)}</div>
                <div className="text-muted-foreground flex items-center gap-1 text-sm">
                  <MapPin className="size-3.5" />
                  {roomMap.get(a.roomId)?.areaName} / {roomMap.get(a.roomId)?.name}
                </div>
              </div>
              {a.date === today && <Badge variant="success">本日</Badge>}
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="open" className="flex flex-col gap-2">
        <p className="text-muted-foreground px-1 text-xs">早い者順です。取得するとあなたの確定シフトに入り、他の人の一覧から消えます。</p>
        {available.length === 0 && <p className="text-muted-foreground py-10 text-center text-sm">いま募集中の空き枠はありません</p>}
        {available.map((o) => (
          <Card key={o.id} className="py-3">
            <CardContent className="flex items-center gap-3">
              <div className="flex-1">
                <div className="font-semibold">{formatDateJa(o.date)}</div>
                <div className="text-lg tabular-nums">{fmtRange(o.start, o.end)}</div>
                <div className="text-muted-foreground text-sm">
                  {roomMap.get(o.roomId)?.areaName} / {roomMap.get(o.roomId)?.name}
                </div>
              </div>
              {conflicts(o) ? (
                <Badge variant="outline">シフトと重複</Badge>
              ) : (
                <Button size="touch" onClick={() => setTaking(o)}>
                  取得する
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </TabsContent>

      <Dialog open={!!taking} onOpenChange={(o) => !o && setTaking(null)}>
        <DialogContent>
          {taking && (
            <>
              <DialogHeader>
                <DialogTitle>この空き枠を取得しますか?</DialogTitle>
                <DialogDescription>
                  {formatDateJa(taking.date)} {fmtRange(taking.start, taking.end)} / {roomMap.get(taking.roomId)?.name}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex-row">
                <Button variant="outline" size="touch" className="flex-1" onClick={() => setTaking(null)}>
                  やめる
                </Button>
                <Button
                  size="touch"
                  className="flex-1"
                  onClick={() => {
                    const ok = repo.openSlots.take(taking.id, me.id);
                    if (ok) toast.success("取得しました。確定シフトに追加されました");
                    else toast.error("ほかの人が先に取得しました");
                    setTaking(null);
                  }}
                >
                  取得する
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
