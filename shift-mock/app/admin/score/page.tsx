"use client";
import Link from "next/link";
import { useMemo } from "react";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { ScoreBadge } from "@/components/score-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useAttendance, useCurrentStore, useMetrics, useStoreStaff } from "@/lib/hooks";
import { computeMetrics } from "@/lib/metrics";
import { repo } from "@/lib/repositories";
import { DEFAULT_SCORE_ITEMS, scoreBand, SCORE_BAND_STYLE, type ScoreBand } from "@/lib/score";
import { todayStr } from "@/lib/date";
import { useData } from "@/lib/store";
import { cn } from "@/lib/utils";

const ITEM_HELP: Record<string, string> = {
  attendanceRate: "シフトに入った回数 ÷ 予定回数",
  lateRate: "出勤のうち遅刻した割合(10%で0点)",
  sameDayAbsenceRate: "当日欠勤の割合(8%で0点)",
  absenceRate: "事前連絡ありの欠勤の割合(12%で0点)",
  requestVolume: "月20回の出勤希望で満点",
};

export default function ScoreSettingsPage() {
  return (
    <PermissionGate perm="score">
      <ScoreSettings />
    </PermissionGate>
  );
}

function ScoreSettings() {
  const items = useData((d) => d.scoreItems);
  const store = useCurrentStore();
  const staff = useStoreStaff(store.id);
  const metrics = useMetrics("6m");
  const records = useAttendance();
  const baseline = useMemo(
    () => computeMetrics(staff.map((s) => s.id), records, todayStr(), 182, DEFAULT_SCORE_ITEMS),
    [staff, records],
  );
  const total = items.reduce((a, i) => a + i.weight, 0);

  const dist = useMemo(() => {
    const d: Record<ScoreBand, number> = { high: 0, good: 0, mid: 0, low: 0 };
    for (const s of staff) d[scoreBand(metrics.get(s.id)?.score ?? 0)]++;
    return d;
  }, [staff, metrics]);

  const movers = useMemo(
    () =>
      staff
        .map((s) => ({ s, now: metrics.get(s.id)!.score, base: baseline.get(s.id)!.score }))
        .sort((a, b) => Math.abs(b.now - b.base) - Math.abs(a.now - a.base))
        .slice(0, 8),
    [staff, metrics, baseline],
  );

  return (
    <div>
      <PageHeader
        title="スコア設定"
        description="項目の比重を変えると、スタッフ一覧・配置ボード・自動仮組みのスコアが即時に再計算されます(半年間の実績で計算)"
        actions={
          <Button variant="outline" onClick={() => repo.settings.resetScoreWeights()}>
            <RotateCcw /> 初期値に戻す
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>評価項目と比重</CardTitle>
            <CardDescription>スコア = 0.1 + 9.9 × (各項目の達成度 × 比重 の加重平均)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            {items.map((i) => (
              <div key={i.key} className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="font-medium">{i.label}</span>
                    <Badge variant={i.positive ? "success" : "warning"} className="ml-2">{i.positive ? "加点" : "減点"}</Badge>
                    <p className="text-muted-foreground text-xs">{ITEM_HELP[i.key]}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums">{i.weight}</div>
                    <div className="text-muted-foreground text-[11px] tabular-nums">{total ? Math.round((i.weight / total) * 100) : 0}%</div>
                  </div>
                </div>
                <Slider value={[i.weight]} min={0} max={10} step={1} onValueChange={([v]) => repo.settings.setScoreWeight(i.key, v)} onValueCommit={() => repo.settings.commitScoreWeights()} />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">スコア分布({store.name})</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(Object.keys(dist) as ScoreBand[]).map((b) => (
                <div key={b} className="flex items-center gap-2 text-sm">
                  <span className="w-20 text-xs">{SCORE_BAND_STYLE[b].label}</span>
                  <div className="bg-muted h-5 flex-1 overflow-hidden rounded">
                    <div className={cn("h-full transition-all", SCORE_BAND_STYLE[b].dot)} style={{ width: `${(dist[b] / Math.max(1, staff.length)) * 100}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{dist[b]}名</span>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">初期設定からの変化が大きい人</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y text-sm">
              {movers.map(({ s, now, base }) => (
                <div key={s.id} className="flex items-center justify-between py-1.5">
                  <span>{s.name}</span>
                  <span className="flex items-center gap-1.5 tabular-nums">
                    <span className="text-muted-foreground">{base.toFixed(1)} →</span>
                    <ScoreBadge score={now} />
                  </span>
                </div>
              ))}
              <Link href="/admin/staff" className="text-primary pt-2 text-xs underline">スタッフ一覧で確認する</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
