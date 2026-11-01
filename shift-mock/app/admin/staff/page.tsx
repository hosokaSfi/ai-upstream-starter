"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Lock, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { ScoreBadge, ScoreLegend } from "@/components/score-chip";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAlerts, useCurrentStore, useMetrics, useRoomMap, useStoreStaff } from "@/lib/hooks";
import { PERIODS, type PeriodKey } from "@/lib/stats";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "name" | "score" | "requested" | "worked" | "absenceRate" | "late" | "sameDayAbsent";
const pctFmt = (v: number) => `${(v * 100).toFixed(1)}%`;

type SortState = { key: SortKey; desc: boolean };

function SortHead({ k, children, className, sort, setSort }: { k: SortKey; children: React.ReactNode; className?: string; sort: SortState; setSort: React.Dispatch<React.SetStateAction<SortState>> }) {
  return (
    <TableHead className={className}>
      <button className="inline-flex min-h-8 items-center gap-0.5" onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : k !== "name" }))}>
        {children}
        {sort.key === k && (sort.desc ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
      </button>
    </TableHead>
  );
}

export default function StaffListPage() {
  return (
    <PermissionGate perm="staffList">
      <StaffList />
    </PermissionGate>
  );
}

function StaffList() {
  const store = useCurrentStore();
  const staff = useStoreStaff(store.id);
  const [period, setPeriod] = useState<PeriodKey>("1m");
  const metrics = useMetrics(period);
  const m1 = useMetrics("1m");
  const m6 = useMetrics("6m");
  const m1y = useMetrics("1y");
  const alerts = useAlerts();
  const roomMap = useRoomMap();
  const [q, setQ] = useState("");
  const [alertOnly, setAlertOnly] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "score", desc: true });
  const [detail, setDetail] = useState<ID | null>(null);

  const rows = useMemo(() => {
    const list = staff
      .filter((s) => !q || s.name.includes(q) || s.kana.includes(q) || s.aliases.some((a) => a.displayName.includes(q)))
      .filter((s) => !alertOnly || alerts.has(s.id))
      .map((s) => ({ s, m: metrics.get(s.id)! }));
    const val = (r: (typeof list)[number]): number | string => {
      switch (sort.key) {
        case "name": return r.s.kana;
        case "score": return r.m.score;
        case "absenceRate": return r.m.stats.absenceRate;
        default: return r.m.stats[sort.key];
      }
    };
    return list.sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string, "ja") : (x as number) - (y as number);
      return sort.desc ? -c : c;
    });
  }, [staff, q, alertOnly, alerts, metrics, sort]);

  const sp = { sort, setSort };

  const d = staff.find((s) => s.id === detail);
  const alertCount = staff.filter((s) => alerts.has(s.id)).length;

  return (
    <div>
      <PageHeader title="スタッフ一覧" description={`${store.name} ${staff.length}名 / スコアは期間内の出勤記録とスコア設定の比重から算出`} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
          <TabsList>
            {PERIODS.map((p) => (
              <TabsTrigger key={p.key} value={p.key}>{p.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="名前・かな・別名義で検索" className="pl-8" />
        </div>
        <Label className="text-sm">
          <Switch checked={alertOnly} onCheckedChange={setAlertOnly} />
          アラートのみ <Badge variant="destructive">{alertCount}</Badge>
        </Label>
        <div className="flex-1" />
        <ScoreLegend />
      </div>

      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortHead {...sp} k="name">名前</SortHead>
              <SortHead {...sp} k="score">スコア</SortHead>
              <SortHead {...sp} k="requested" className="text-right">希望数</SortHead>
              <SortHead {...sp} k="worked" className="text-right">出勤実数</SortHead>
              <SortHead {...sp} k="absenceRate" className="text-right">欠席率</SortHead>
              <SortHead {...sp} k="late" className="text-right">遅刻</SortHead>
              <SortHead {...sp} k="sameDayAbsent" className="text-right">当日欠勤</SortHead>
              <TableHead>アラート</TableHead>
              <TableHead>別名義</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ s, m }) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setDetail(s.id)}>
                <TableCell className="whitespace-nowrap">
                  <div className="flex items-center gap-1 font-medium">
                    {s.name}
                    {s.fixedRoomId && (
                      <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[11px] font-normal">
                        <Lock className="size-3" />
                        {roomMap.get(s.fixedRoomId)?.name}
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-[11px]">{s.kana}</div>
                </TableCell>
                <TableCell><ScoreBadge score={m.score} /></TableCell>
                <TableCell className="text-right tabular-nums">{m.stats.requested}</TableCell>
                <TableCell className="text-right tabular-nums">{m.stats.worked}</TableCell>
                <TableCell className={cn("text-right tabular-nums", m.stats.absenceRate >= 0.1 && "font-semibold text-rose-700")}>{pctFmt(m.stats.absenceRate)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.stats.late}</TableCell>
                <TableCell className={cn("text-right tabular-nums", m.stats.sameDayAbsent > 0 && "text-rose-700")}>{m.stats.sameDayAbsent}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {alerts.get(s.id)?.map((a) => (
                      <Badge key={a.kind} variant={a.kind === "sameDay" ? "destructive" : "warning"}>{a.label}</Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">{s.aliases.map((a) => a.displayName).join(" / ")}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-muted-foreground py-8 text-center">該当するスタッフがいません</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!d} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          {d && (
            <>
              <DialogHeader>
                <DialogTitle>{d.name}</DialogTitle>
                <DialogDescription>
                  {d.kana} / 入店 {d.joinedAt} / {d.phone}
                </DialogDescription>
              </DialogHeader>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>期間</TableHead>
                    <TableHead>スコア</TableHead>
                    <TableHead className="text-right">希望</TableHead>
                    <TableHead className="text-right">出勤</TableHead>
                    <TableHead className="text-right">欠席率</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {([["直近1か月", m1], ["半年", m6], ["1年", m1y]] as const).map(([label, mm]) => {
                    const x = mm.get(d.id);
                    if (!x) return null;
                    return (
                      <TableRow key={label}>
                        <TableCell>{label}</TableCell>
                        <TableCell><ScoreBadge score={x.score} /></TableCell>
                        <TableCell className="text-right">{x.stats.requested}</TableCell>
                        <TableCell className="text-right">{x.stats.worked}</TableCell>
                        <TableCell className="text-right">{pctFmt(x.stats.absenceRate)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="text-sm">
                <div className="text-muted-foreground mb-1 text-xs">ブランド別の名義</div>
                {d.aliases.map((a) => (
                  <Badge key={a.id} variant="secondary" className="mr-1">{a.displayName}</Badge>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
