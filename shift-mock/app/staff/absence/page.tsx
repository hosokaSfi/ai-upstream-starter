"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addDays, fmtRange, formatDateJa, formatDateTime, todayStr } from "@/lib/date";
import { useMe } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import { cn } from "@/lib/utils";

const REASONS = ["体調不良", "家庭の事情", "交通機関の遅延・運休", "その他"];

export default function AbsencePage() {
  const me = useMe();
  const absences = useData((d) => d.absences);
  const assignments = useData((d) => d.assignments);
  const today = todayStr();
  const [date, setDate] = useState(today);
  const [reason, setReason] = useState(REASONS[0]);
  const [detail, setDetail] = useState("");

  const myShiftOnDate = assignments.find((a) => a.staffId === me.id && a.date === date && a.status === "confirmed");
  const mine = useMemo(() => absences.filter((a) => a.staffId === me.id), [absences, me.id]);

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <CardHeader>
          <CardTitle>急な休みの報告</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label>日付</Label>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((d) => {
                const v = addDays(today, d);
                return (
                  <Button key={d} type="button" size="touch" variant={date === v ? "default" : "outline"} onClick={() => setDate(v)}>
                    {d === 0 ? "今日" : d === 1 ? "明日" : formatDateJa(v)}
                  </Button>
                );
              })}
            </div>
            <Input type="date" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="h-12" />
            <p className="text-muted-foreground text-xs">
              {myShiftOnDate ? `この日のシフト: ${fmtRange(myShiftOnDate.start, myShiftOnDate.end)}` : "この日は確定シフトがありません"}
            </p>
          </div>
          <div className="grid gap-2">
            <Label>理由</Label>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={cn("min-h-12 rounded-lg border-2 px-3 text-sm", reason === r ? "border-primary bg-primary/10 font-semibold" : "border-border")}
                >
                  {r}
                </button>
              ))}
            </div>
            <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="補足(任意)" />
          </div>
          <Button
            size="touch"
            variant="destructive"
            onClick={() => {
              repo.absences.report({ storeId: me.storeId, staffId: me.id, date, reason: detail ? `${reason}: ${detail}` : reason });
              setDetail("");
              toast.success("休みの報告を送信しました", { description: "管理者の配置ボードに表示されます" });
            }}
          >
            送信する
          </Button>
          {date === today && (
            <p className="flex items-center gap-1.5 rounded-md bg-amber-50 p-2 text-xs text-amber-900">
              <Phone className="size-3.5" /> 当日の休みは、送信後に店舗へ電話でも連絡してください。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">送信履歴</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y text-sm">
          {mine.length === 0 && <p className="text-muted-foreground">履歴はありません</p>}
          {mine.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-2 py-2">
              <div>
                <div className="font-medium">{formatDateJa(a.date)} {a.reason}</div>
                <div className="text-muted-foreground text-xs">送信 {formatDateTime(a.createdAt)}</div>
              </div>
              {a.acknowledged ? <Badge variant="success">確認済み</Badge> : <Badge variant="warning">確認待ち</Badge>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
