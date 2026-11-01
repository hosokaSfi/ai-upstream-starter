"use client";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addMonths, daysInMonth, fmtRange, formatDateJa, formatDateTime, formatMonthJa, monthOf, todayStr, weekdayIndex } from "@/lib/date";
import { useCurrentStore, useMe } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { deadlineFor } from "@/lib/requests";
import { useData } from "@/lib/store";
import type { DateStr, ShiftRequestEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const BAND_STYLE: Record<string, string> = {
  early: "bg-sky-100 text-sky-900",
  middle: "bg-emerald-100 text-emerald-900",
  late: "bg-violet-100 text-violet-900",
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return d > 0 ? `${d}日 ${h}時間 ${m}分` : `${h}時間 ${m}分 ${sec}秒`;
}

export default function ShiftRequestPage() {
  const me = useMe();
  const store = useCurrentStore();
  const requests = useData((d) => d.requests);
  const thisMonth = monthOf(todayStr());
  const [month, setMonth] = useState(addMonths(thisMonth, 1));
  const [simulateExpired, setSimulateExpired] = useState(false);
  const now = useNow();

  const saved = useMemo(() => requests.find((r) => r.staffId === me.id && r.month === month), [requests, me.id, month]);
  const deadline = deadlineFor(month, store.settings.submissionDeadlineDay);
  const locked = simulateExpired || now > deadline.getTime();
  const bands = store.settings.timeBands;

  // 編集中の内容(保存済みから開始)
  const [draft, setDraft] = useState<{ key: string; entries: ShiftRequestEntry[] }>({ key: "", entries: [] });
  const key = `${me.id}_${month}_${saved?.submittedAt ?? ""}`;
  const entries = useMemo(() => (draft.key === key ? draft.entries : (saved?.entries ?? [])), [draft, key, saved]);
  const setEntries = (e: ShiftRequestEntry[]) => setDraft({ key, entries: e });
  const dirty = draft.key === key && JSON.stringify(draft.entries) !== JSON.stringify(saved?.entries ?? []);

  const [editing, setEditing] = useState<DateStr | null>(null);
  const days = daysInMonth(month);
  const lead = weekdayIndex(days[0]);
  const byDate = useMemo(() => {
    const m = new Map<DateStr, string[]>();
    for (const e of entries) m.set(e.date, [...(m.get(e.date) ?? []), e.bandId]);
    return m;
  }, [entries]);

  const toggle = (date: DateStr, bandId: string) => {
    const has = entries.some((e) => e.date === date && e.bandId === bandId);
    setEntries(has ? entries.filter((e) => !(e.date === date && e.bandId === bandId)) : [...entries, { date, bandId }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={month} onValueChange={setMonth}>
        <TabsList className="w-full">
          <TabsTrigger value={thisMonth}>{formatMonthJa(thisMonth)}</TabsTrigger>
          <TabsTrigger value={addMonths(thisMonth, 1)}>{formatMonthJa(addMonths(thisMonth, 1))}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className={locked ? "bg-muted" : "border-primary/40"}>
        <CardContent className="flex items-center gap-3">
          {locked ? <Lock className="text-muted-foreground size-6" /> : <Clock className="text-primary size-6" />}
          <div className="flex-1">
            <div className="text-muted-foreground text-xs">
              提出期限 {deadline.getMonth() + 1}/{deadline.getDate()} 23:59
            </div>
            {locked ? (
              <div className="font-semibold">期限を過ぎたため変更できません</div>
            ) : (
              <div className="text-lg font-bold tabular-nums">あと {countdown(deadline.getTime() - now)}</div>
            )}
          </div>
          <div className="text-right text-xs">
            {saved?.submittedAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="size-4" /> 提出済み
                <br />
                {formatDateTime(saved.submittedAt)}
              </span>
            ) : (
              <span className="font-semibold text-rose-700">未提出</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="text-muted-foreground flex flex-wrap items-center gap-2 px-1 text-xs">
        日付をタップして出勤できる時間帯を選択:
        {bands.map((b) => (
          <span key={b.id} className={cn("rounded px-1.5 py-0.5", BAND_STYLE[b.id] ?? "bg-muted")}>
            {b.label} {fmtRange(b.start, b.end)}
          </span>
        ))}
      </div>

      <div className="bg-card overflow-hidden rounded-xl border">
        <div className="text-muted-foreground grid grid-cols-7 border-b text-center text-xs">
          {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
            <div key={w} className={cn("py-1.5", i === 0 && "text-rose-600", i === 6 && "text-sky-700")}>
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: lead }, (_, i) => (
            <div key={`l${i}`} className="bg-muted/40 border-r border-b" />
          ))}
          {days.map((date) => {
            const sel = byDate.get(date) ?? [];
            return (
              <button
                key={date}
                disabled={locked}
                onClick={() => setEditing(date)}
                className={cn(
                  "flex min-h-16 flex-col items-stretch gap-0.5 border-r border-b p-1 text-left disabled:cursor-not-allowed",
                  sel.length > 0 && "bg-primary/5",
                )}
              >
                <span className={cn("text-xs", weekdayIndex(date) === 0 && "text-rose-600", weekdayIndex(date) === 6 && "text-sky-700")}>
                  {Number(date.slice(8))}
                </span>
                {bands
                  .filter((b) => sel.includes(b.id))
                  .map((b) => (
                    <span key={b.id} className={cn("rounded px-0.5 text-center text-[10px] leading-4", BAND_STYLE[b.id] ?? "bg-muted")}>
                      {b.label.slice(0, 1)}
                    </span>
                  ))}
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-muted-foreground flex items-center justify-between px-1 text-sm">
        <span>
          選択: <b className="text-foreground">{byDate.size}日</b> / {entries.length}枠
        </span>
        <Label className="text-xs">
          デモ: 期限切れ表示
          <Switch checked={simulateExpired} onCheckedChange={setSimulateExpired} />
        </Label>
      </div>

      {!locked && (
        <div className="bg-background/95 sticky bottom-16 z-20 -mx-3 border-t px-3 py-2 backdrop-blur">
          <Button
            size="touch"
            className="w-full"
            disabled={entries.length === 0 && !saved?.submittedAt}
            onClick={() => {
              repo.requests.submit(me.id, me.storeId, month, entries);
              toast.success(`${formatMonthJa(month)}のシフト希望を提出しました`, { description: "期限までは何度でも修正できます" });
            }}
          >
            {saved?.submittedAt ? (dirty ? "修正して再提出" : "再提出") : "この内容で提出する"}
          </Button>
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          {editing && (
            <>
              <DialogHeader>
                <DialogTitle>{formatDateJa(editing)}</DialogTitle>
                <DialogDescription>出勤できる時間帯を選んでください(複数可)</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2">
                {bands.map((b) => {
                  const on = (byDate.get(editing) ?? []).includes(b.id);
                  return (
                    <button
                      key={b.id}
                      onClick={() => toggle(editing, b.id)}
                      className={cn(
                        "flex min-h-14 items-center justify-between rounded-lg border-2 px-4 text-left",
                        on ? "border-primary bg-primary/10" : "border-border",
                      )}
                      aria-pressed={on}
                    >
                      <span className="font-semibold">{b.label}</span>
                      <span className="tabular-nums">{fmtRange(b.start, b.end)}</span>
                    </button>
                  );
                })}
              </div>
              <DialogFooter className="flex-row">
                <Button variant="outline" size="touch" className="flex-1" onClick={() => setEntries(entries.filter((e) => e.date !== editing))}>
                  この日はなし
                </Button>
                <Button size="touch" className="flex-1" onClick={() => setEditing(null)}>
                  決定
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
