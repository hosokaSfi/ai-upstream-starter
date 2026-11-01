"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAlerts, useCurrentStore, useStoreStaff } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import type { AlertSetting } from "@/lib/types";

export default function AlertSettingsPage() {
  return (
    <PermissionGate perm="alerts">
      <AlertSettings />
    </PermissionGate>
  );
}

function ThresholdInputs({ value, onSave, saveLabel }: { value: AlertSetting; onSave: (v: AlertSetting) => void; saveLabel: string }) {
  const [min, setMin] = useState(value.minMonthlyShifts);
  const [max, setMax] = useState(value.maxSameDayAbsences);
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5">
        <Label className="text-xs">直近30日の出勤が N 回未満で「出勤頻度低下」</Label>
        <Input type="number" min={0} max={31} value={min} onChange={(e) => setMin(Number(e.target.value))} className="w-28" />
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">直近30日の当日欠勤が N 回以上で「当日欠勤」</Label>
        <Input type="number" min={1} max={31} value={max} onChange={(e) => setMax(Number(e.target.value))} className="w-28" />
      </div>
      <Button onClick={() => onSave({ ...value, minMonthlyShifts: min, maxSameDayAbsences: max })}>{saveLabel}</Button>
    </div>
  );
}

function AlertSettings() {
  const store = useCurrentStore();
  const staff = useStoreStaff(store.id);
  const settings = useData((d) => d.alertSettings);
  const alerts = useAlerts();
  const def = settings.find((s) => s.staffId === "default") ?? { staffId: "default", minMonthlyShifts: 4, maxSameDayAbsences: 2 };
  const overrides = useMemo(() => settings.filter((s) => staff.some((x) => x.id === s.staffId)), [settings, staff]);
  const candidates = staff.filter((s) => !overrides.some((o) => o.staffId === s.id));
  const [newStaff, setNewStaff] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="アラート設定" description="出勤頻度の低下と当日欠勤を検知し、スタッフ一覧にバッジを表示します。スタッフごとに閾値を変えられます。" />
      <Card>
        <CardHeader>
          <CardTitle>全体の既定値</CardTitle>
          <CardDescription>個別設定がないスタッフに適用(現在 {store.name} でアラート対象 {staff.filter((s) => alerts.has(s.id)).length}名)</CardDescription>
        </CardHeader>
        <CardContent>
          <ThresholdInputs
            key={`${def.minMonthlyShifts}-${def.maxSameDayAbsences}`}
            value={def}
            saveLabel="既定値を保存"
            onSave={(v) => {
              repo.settings.upsertAlertSetting(v);
              toast.success("既定値を保存しました");
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>スタッフ個別の閾値</CardTitle>
          <CardDescription>例: 週4日入る契約の人は「月8回未満」でアラート、など</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <NativeSelect value={newStaff} onChange={(e) => setNewStaff(e.target.value)} className="w-60">
              <option value="">スタッフを選択…</option>
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </NativeSelect>
            <Button
              variant="outline"
              disabled={!newStaff}
              onClick={() => {
                repo.settings.upsertAlertSetting({ ...def, staffId: newStaff });
                setNewStaff("");
              }}
            >
              個別設定を追加
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ</TableHead>
                <TableHead>閾値</TableHead>
                <TableHead>現在の状態</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o) => {
                const s = staff.find((x) => x.id === o.staffId)!;
                return (
                  <TableRow key={o.staffId}>
                    <TableCell className="font-medium whitespace-nowrap">{s.name}</TableCell>
                    <TableCell>
                      <ThresholdInputs key={`${o.minMonthlyShifts}-${o.maxSameDayAbsences}`} value={o} saveLabel="保存" onSave={(v) => { repo.settings.upsertAlertSetting(v); toast.success(`${s.name}さんの閾値を保存しました`); }} />
                    </TableCell>
                    <TableCell>
                      {alerts.get(o.staffId)?.map((a) => (
                        <Badge key={a.kind} variant={a.kind === "sameDay" ? "destructive" : "warning"} className="mr-1">{a.label}</Badge>
                      )) ?? <Badge variant="success">正常</Badge>}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" aria-label="個別設定を解除" onClick={() => repo.settings.removeAlertSetting(o.staffId)}>
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {overrides.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground py-6 text-center">個別設定はありません</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
