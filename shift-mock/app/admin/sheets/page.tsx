"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileDown, FileUp, Info } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addDays, fmtMin, formatDateJa, todayStr } from "@/lib/date";
import { useCurrentStore, useRoomMap } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";

const COLS = ["日付", "曜日", "エリア", "部屋", "スタッフ", "名義", "開始", "終了"] as const;

export default function SheetsPage() {
  return (
    <PermissionGate perm="sheets">
      <Sheets />
    </PermissionGate>
  );
}

function toCsv(rows: string[][]) {
  return "﻿" + rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
}

function Sheets() {
  const store = useCurrentStore();
  const assignments = useData((d) => d.assignments);
  const staff = useData((d) => d.staff);
  const roomMap = useRoomMap();
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(addDays(todayStr(), 6));
  const [preview, setPreview] = useState<string[][] | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const rows = useMemo(
    () =>
      assignments
        .filter((a) => a.storeId === store.id && a.status === "confirmed" && a.date >= from && a.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start)
        .map((a) => {
          const s = staff.find((x) => x.id === a.staffId);
          const r = roomMap.get(a.roomId);
          const brandAlias = s?.aliases.find((al) => store.brandIds.includes(al.brandId))?.displayName ?? "";
          const ja = formatDateJa(a.date);
          return [a.date, ja.slice(-2, -1), r?.areaName ?? "", r?.name ?? "", s?.name ?? a.staffId, brandAlias, fmtMin(a.start), fmtMin(a.end)];
        }),
    [assignments, staff, roomMap, store, from, to],
  );

  const download = () => {
    const blob = new Blob([toCsv([[...COLS], ...rows])], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `確定シフト_${store.name}_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader title="Googleスプレッドシート連携" description="確定シフトをスプレッドシートへ書き出し/読み取りします。" />
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        モックでは Google API に接続しません。書き出しは「プレビュー表示+CSVダウンロード」、読み取りはサンプルの差分表示で代用しています。
      </div>
      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">対象期間</CardTitle>
            <CardDescription>{store.name} の確定シフト {rows.length}件</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1"><Label className="text-xs">開始日</Label><Input type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} /></div>
              <div className="grid gap-1"><Label className="text-xs">終了日</Label><Input type="date" value={to} onChange={(e) => e.target.value && setTo(e.target.value)} /></div>
            </div>
            <Button
              onClick={() => {
                setPreview([[...COLS], ...rows]);
                repo.sheets.logExport(rows.length, `${from}〜${to}`);
                toast.success("書き出し内容を作成しました(モック)");
              }}
            >
              <FileUp /> 確定シフトを書き出す
            </Button>
            <Button variant="outline" onClick={() => { setImportOpen(true); repo.sheets.logImport(3); }}>
              <FileDown /> スプレッドシートから読み取る
            </Button>
            {preview && (
              <Button variant="secondary" onClick={download}><Download /> CSVをダウンロード</Button>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">書き出しプレビュー <span className="text-muted-foreground text-xs font-normal">シート名: 確定シフト_{store.name}</span></CardTitle>
          </CardHeader>
          <CardContent>
            {!preview ? (
              <p className="text-muted-foreground py-12 text-center text-sm">「確定シフトを書き出す」を押すと、スプレッドシートに書き込まれる内容を表示します</p>
            ) : (
              <div className="max-h-[65dvh] overflow-auto rounded border">
                <Table>
                  <TableHeader className="sticky top-0">
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      {preview[0].map((h, i) => (<TableHead key={i}>{String.fromCharCode(65 + i)}: {h}</TableHead>))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.slice(1).map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground text-center text-xs">{i + 2}</TableCell>
                        {r.map((c, j) => (<TableCell key={j} className="whitespace-nowrap tabular-nums">{c}</TableCell>))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>読み取り結果(サンプル)</DialogTitle>
            <DialogDescription>スプレッドシートで手修正された内容と、システムの確定シフトの差分を表示します。</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow><TableHead>行</TableHead><TableHead>内容</TableHead><TableHead>差分</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 3).map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{i + 2}</TableCell>
                  <TableCell className="text-xs">{r[0]} {r[3]} {r[4]}</TableCell>
                  <TableCell>{i === 1 ? <Badge variant="warning">終了 {r[7]} → 修正あり</Badge> : <Badge variant="success">一致</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>閉じる</Button>
            <Button onClick={() => { toast.info("本番では差分を確認のうえ配置に反映します"); setImportOpen(false); }}>差分を反映(モック)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
