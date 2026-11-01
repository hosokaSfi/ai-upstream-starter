"use client";
import Link from "next/link";
import { useMemo } from "react";
import { Bell, CalendarClock, ChevronRight, MessageSquareText, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { fmtRange, formatDateJa, formatDateTime, todayStr } from "@/lib/date";
import { useFineBalance, useMe, useRoomMap } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData, useSession } from "@/lib/store";
import { yen } from "@/lib/utils";

export default function StaffHome() {
  const me = useMe();
  const session = useSession();
  const notices = useData((d) => d.notices);
  const handovers = useData((d) => d.handovers);
  const assignments = useData((d) => d.assignments);
  const fines = useData((d) => d.fines);
  const pays = useData((d) => d.finePayments);
  const staffAll = useData((d) => d.staff);
  const roomMap = useRoomMap();
  const balance = useFineBalance(me.id);

  const myNotices = useMemo(() => notices.filter((n) => n.storeId === me.storeId), [notices, me.storeId]);
  const loginNotices = myNotices.filter((n) => n.showOnLogin);
  const myHandovers = useMemo(() => handovers.filter((h) => h.staffId === me.id), [handovers, me.id]);
  const upcoming = useMemo(() => {
    const today = todayStr();
    return assignments
      .filter((a) => a.staffId === me.id && a.status === "confirmed" && a.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  }, [assignments, me.id]);
  const next = upcoming[0];
  const fineHistory = useMemo(
    () =>
      [
        ...fines.filter((f) => f.staffId === me.id).map((f) => ({ id: f.id, date: f.date, label: f.reason, amount: f.amount })),
        ...pays.filter((p) => p.staffId === me.id).map((p) => ({ id: p.id, date: p.date, label: "お支払い", amount: -p.amount })),
      ].sort((a, b) => b.date.localeCompare(a.date)),
    [fines, pays, me.id],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="px-1">
        <p className="text-muted-foreground text-xs">おつかれさまです</p>
        <h1 className="text-lg font-bold">{me.name} さん</h1>
      </div>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarClock className="text-primary size-4" /> 次回のシフト
          </CardTitle>
        </CardHeader>
        <CardContent>
          {next ? (
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-bold">{formatDateJa(next.date)}</div>
                <div className="text-lg tabular-nums">{fmtRange(next.start, next.end)}</div>
                <div className="text-muted-foreground text-sm">
                  {roomMap.get(next.roomId)?.areaName} / {roomMap.get(next.roomId)?.name}
                </div>
              </div>
              <Button asChild variant="outline" size="lg">
                <Link href="/staff/shifts">
                  一覧 <ChevronRight />
                </Link>
              </Button>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">確定したシフトはありません。空き枠タブから取得できます。</p>
          )}
        </CardContent>
      </Card>

      <Card id="fine" className={balance > 0 ? "border-rose-200" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Wallet className="size-4 text-rose-600" /> 罰金残金
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={balance > 0 ? "text-2xl font-bold text-rose-700" : "text-2xl font-bold"}>{yen(balance)}</div>
          {fineHistory.length > 0 && (
            <ul className="text-muted-foreground mt-2 divide-y text-sm">
              {fineHistory.map((h) => (
                <li key={h.id} className="flex justify-between py-1.5">
                  <span>
                    {formatDateJa(h.date)} {h.label}
                  </span>
                  <span className={h.amount < 0 ? "text-emerald-700 tabular-nums" : "tabular-nums"}>
                    {h.amount < 0 ? `−${yen(-h.amount)}` : `+${yen(h.amount)}`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquareText className="size-4" /> あなたへの申し送り
            {myHandovers.some((h) => !h.read) && <Badge variant="destructive">未読 {myHandovers.filter((h) => !h.read).length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {myHandovers.length === 0 && <p className="text-muted-foreground text-sm">申し送りはありません</p>}
          {myHandovers.map((h) => (
            <button
              key={h.id}
              onClick={() => repo.comms.markHandoverRead(h.id)}
              className={`min-h-11 rounded-lg border p-3 text-left text-sm ${h.read ? "bg-background" : "border-amber-300 bg-amber-50"}`}
            >
              <div className="text-muted-foreground mb-1 flex justify-between text-xs">
                <span>{formatDateTime(h.createdAt)}</span>
                {!h.read && <span className="font-semibold text-amber-800">タップで既読</span>}
              </div>
              {h.body}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="size-4" /> お知らせ
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {myNotices.map((n) => (
            <div key={n.id} className="py-2.5 text-sm">
              <div className="flex items-center gap-2 font-medium">
                {n.title}
                {n.showOnLogin && <Badge variant="warning">重要</Badge>}
              </div>
              <p className="text-muted-foreground mt-1">{n.body}</p>
              <p className="text-muted-foreground mt-1 text-xs">{formatDateTime(n.createdAt)}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="flex flex-col gap-2 text-sm">
          <span className="text-muted-foreground text-xs">デモ用: 表示するスタッフを切り替え(空き枠の早い者順の確認などに)</span>
          <NativeSelect value={session.staffId} onChange={(e) => repo.auth.switchStaff(e.target.value)} className="w-full">
            {staffAll
              .filter((s) => s.storeId === me.storeId && s.active)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}({s.aliases.map((a) => a.displayName).join("/")})
                </option>
              ))}
          </NativeSelect>
        </CardContent>
      </Card>

      <Dialog open={loginNotices.length > 0 && !session.loginNoticeClosedAt} onOpenChange={(o) => !o && repo.auth.closeLoginNotice()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>お知らせ</DialogTitle>
            <DialogDescription>ログイン時に表示しています</DialogDescription>
          </DialogHeader>
          {loginNotices.map((n) => (
            <div key={n.id} className="rounded-lg border p-3 text-sm">
              <div className="font-semibold">{n.title}</div>
              <p className="text-muted-foreground mt-1">{n.body}</p>
            </div>
          ))}
          <DialogFooter>
            <Button size="touch" className="w-full" onClick={() => repo.auth.closeLoginNotice()}>
              確認しました
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
