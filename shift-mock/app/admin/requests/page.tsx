"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BellRing } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addMonths, daysInMonth, fmtRange, formatDateJa, formatMonthJa, monthOf, todayStr, weekdayIndex } from "@/lib/date";
import { useCurrentStore, useStoreAreasRooms, useStoreStaff } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { deadlineFor } from "@/lib/requests";
import { useData } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function RequestSummaryPage() {
  return (
    <PermissionGate perm="requests">
      <RequestSummary />
    </PermissionGate>
  );
}

/** 希望人数 ÷ 部屋数 で色の濃さを決める */
function heatClass(ratio: number) {
  if (ratio === 0) return "bg-slate-50 text-slate-400";
  if (ratio < 0.3) return "bg-rose-100 text-rose-900";
  if (ratio < 0.55) return "bg-amber-100 text-amber-900";
  if (ratio < 0.85) return "bg-sky-100 text-sky-900";
  if (ratio < 1.2) return "bg-sky-300 text-sky-950";
  return "bg-sky-600 text-white";
}

function RequestSummary() {
  const store = useCurrentStore();
  const staff = useStoreStaff(store.id);
  const groups = useStoreAreasRooms(store.id);
  const roomCount = groups.reduce((a, g) => a + g.rooms.length, 0);
  const requests = useData((d) => d.requests);
  const thisMonth = monthOf(todayStr());
  const [month, setMonth] = useState(addMonths(thisMonth, 1));
  const bands = store.settings.timeBands;

  const monthReqs = useMemo(
    () => requests.filter((r) => r.month === month && r.storeId === store.id && staff.some((s) => s.id === r.staffId)),
    [requests, month, store.id, staff],
  );
  const submittedIds = new Set(monthReqs.filter((r) => r.submittedAt).map((r) => r.staffId));
  const notSubmitted = staff.filter((s) => !submittedIds.has(s.id));

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of monthReqs) for (const e of r.entries) m.set(`${e.date}|${e.bandId}`, (m.get(`${e.date}|${e.bandId}`) ?? 0) + 1);
    return m;
  }, [monthReqs]);
  const days = daysInMonth(month);
  const deadline = deadlineFor(month, store.settings.submissionDeadlineDay);
  const shortage = days.flatMap((d) => bands.map((b) => ({ d, b, n: counts.get(`${d}|${b.id}`) ?? 0 }))).filter((x) => x.n < roomCount * 0.3);

  return (
    <div>
      <PageHeader
        title="シフト希望の集計"
        description={`${store.name} / 部屋数 ${roomCount} / 提出期限 ${deadline.getMonth() + 1}/${deadline.getDate()}`}
        actions={
          <Tabs value={month} onValueChange={setMonth}>
            <TabsList>
              <TabsTrigger value={thisMonth}>{formatMonthJa(thisMonth)}</TabsTrigger>
              <TabsTrigger value={addMonths(thisMonth, 1)}>{formatMonthJa(addMonths(thisMonth, 1))}</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle className="text-base">日付 × 時間帯の希望人数</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              色は部屋数に対する充足度:
              {[["不足(3割未満)", 0.2], ["少なめ", 0.4], ["標準", 0.7], ["十分", 1], ["多い", 2]].map(([l, r]) => (
                <span key={l as string} className={cn("rounded px-1.5 text-xs", heatClass(r as number))}>{l}</span>
              ))}
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-0.5 text-xs">
              <thead>
                <tr>
                  <th className="text-muted-foreground w-20 text-left font-medium">時間帯</th>
                  {days.map((d) => (
                    <th key={d} className={cn("min-w-7 font-medium", weekdayIndex(d) === 0 && "text-rose-600", weekdayIndex(d) === 6 && "text-sky-700")}>
                      {Number(d.slice(8))}
                      <div className="text-[10px] font-normal">{formatDateJa(d).slice(-2, -1)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bands.map((b) => (
                  <tr key={b.id}>
                    <td className="pr-1 whitespace-nowrap">
                      <div className="font-medium">{b.label}</div>
                      <div className="text-muted-foreground text-[10px]">{fmtRange(b.start, b.end)}</div>
                    </td>
                    {days.map((d) => {
                      const n = counts.get(`${d}|${b.id}`) ?? 0;
                      return (
                        <td key={d} title={`${formatDateJa(d)} ${b.label}: ${n}名`} className={cn("h-9 rounded text-center font-semibold tabular-nums", heatClass(roomCount ? n / roomCount : 0))}>
                          {n || ""}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {shortage.length > 0 && (
              <p className="mt-3 text-sm text-rose-700">
                希望人数が部屋数の3割に届かない枠が {shortage.length} 件あります(空き枠の公開や個別の声かけを検討)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              提出状況
              <span className="text-sm font-normal">
                <b className="text-lg">{submittedIds.size}</b> / {staff.length}名
              </span>
            </CardTitle>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div className="bg-primary h-full" style={{ width: `${(submittedIds.size / Math.max(1, staff.length)) * 100}%` }} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">未提出 <Badge variant="destructive">{notSubmitted.length}名</Badge></span>
              <Button
                size="sm"
                variant="outline"
                disabled={!notSubmitted.length}
                onClick={() => {
                  repo.comms.sendReminder(notSubmitted.map((s) => s.id), month);
                  toast.success(`${notSubmitted.length}名にリマインドを送信しました(モック)`);
                }}
              >
                <BellRing /> リマインド
              </Button>
            </div>
            <ul className="max-h-[60dvh] divide-y overflow-y-auto text-sm">
              {notSubmitted.map((s) => (
                <li key={s.id} className="flex justify-between py-1.5">
                  <span>{s.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{s.phone}</span>
                </li>
              ))}
              {notSubmitted.length === 0 && <li className="text-muted-foreground py-4 text-center">全員提出済みです</li>}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
