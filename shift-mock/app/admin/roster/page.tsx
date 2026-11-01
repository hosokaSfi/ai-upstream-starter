"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FileUp, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { todayStr } from "@/lib/date";
import { useCurrentStore, useStoreAreasRooms } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import type { ID, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
// ブランドはマスタ(本番は brands コレクション)
import { BRANDS } from "@/mock/master";

const HEADERS = ["氏名", "ふりがな", "電話番号", "主担当エリア", "固定部屋", "ブランド1", "名義1", "ブランド2", "名義2"] as const;

export default function RosterPage() {
  return (
    <PermissionGate perm="roster">
      <Roster />
    </PermissionGate>
  );
}

function Roster() {
  const store = useCurrentStore();
  const allStaff = useData((d) => d.staff);
  const staff = useMemo(() => allStaff.filter((s) => s.storeId === store.id), [allStaff, store.id]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ID | null>(null);
  const rows = staff.filter((s) => !q || s.name.includes(q) || s.kana.includes(q) || s.aliases.some((a) => a.displayName.includes(q)));
  const multi = staff.filter((s) => s.aliases.length > 1).length;

  return (
    <div>
      <PageHeader title="名簿管理" description={`1人のスタッフがブランドごとに別名義を持てます(${store.name}: ${staff.length}名 / 複数名義 ${multi}名)`} />
      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">名簿</TabsTrigger>
          <TabsTrigger value="import">Excel / CSV 一括登録</TabsTrigger>
        </TabsList>
        <TabsContent value="list" className="flex flex-col gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="氏名・別名義で検索" className="pl-8" />
          </div>
          <div className="bg-card rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>氏名</TableHead>
                  {store.brandIds.map((b) => (
                    <TableHead key={b}>{BRANDS.find((x) => x.id === b)?.name} の名義</TableHead>
                  ))}
                  <TableHead>電話番号</TableHead>
                  <TableHead>在籍</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((s) => (
                  <TableRow key={s.id} className={cn(!s.active && "opacity-50")}>
                    <TableCell className="whitespace-nowrap">
                      <div className="font-medium">{s.name}</div>
                      <div className="text-muted-foreground text-[11px]">{s.kana}</div>
                    </TableCell>
                    {store.brandIds.map((b) => (
                      <TableCell key={b}>
                        {s.aliases.filter((a) => a.brandId === b).map((a) => (
                          <Badge key={a.id} variant="secondary" className="mr-1">{a.displayName}</Badge>
                        ))}
                      </TableCell>
                    ))}
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{s.phone}</TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={(v) => repo.staff.update(s.id, { active: v })} aria-label="在籍" />
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" onClick={() => setEditing(s.id)}>名義を編集</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="import">
          <BulkImport />
        </TabsContent>
      </Tabs>
      <AliasDialog staff={staff.find((s) => s.id === editing)} brandIds={store.brandIds} onClose={() => setEditing(null)} />
    </div>
  );
}

function AliasDialog({ staff, brandIds, onClose }: { staff?: Staff; brandIds: ID[]; onClose: () => void }) {
  return (
    <Dialog open={!!staff} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{staff && <AliasForm key={staff.id} staff={staff} brandIds={brandIds} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function AliasForm({ staff, brandIds, onClose }: { staff: Staff; brandIds: ID[]; onClose: () => void }) {
  const [aliases, setAliases] = useState(staff.aliases);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{staff.name} の名義</DialogTitle>
        <DialogDescription>ブランドごとに表示名(名義)を設定できます。同じブランドで複数持つことも可能です。</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        {aliases.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <NativeSelect value={a.brandId} onChange={(e) => setAliases(aliases.map((x, j) => (j === i ? { ...x, brandId: e.target.value } : x)))} className="w-32">
              {BRANDS.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{brandIds.includes(b.id) ? "" : "(他店舗)"}</option>
              ))}
            </NativeSelect>
            <Input value={a.displayName} onChange={(e) => setAliases(aliases.map((x, j) => (j === i ? { ...x, displayName: e.target.value } : x)))} />
            <Button variant="ghost" size="icon" aria-label="名義を削除" disabled={aliases.length <= 1} onClick={() => setAliases(aliases.filter((_, j) => j !== i))}>
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          onClick={() => setAliases([...aliases, { id: `${staff.id}-al${Date.now()}`, staffId: staff.id, brandId: brandIds[0], displayName: "" }])}
        >
          <Plus /> 名義を追加
        </Button>
      </div>
      <DialogFooter>
        <Button
          onClick={() => {
            if (aliases.some((a) => !a.displayName.trim())) return toast.error("名義が空欄です");
            repo.staff.update(staff.id, { aliases });
            onClose();
          }}
        >
          保存
        </Button>
      </DialogFooter>
    </>
  );
}

type PreviewRow = { values: Record<(typeof HEADERS)[number], string>; errors: string[] };

function BulkImport() {
  const store = useCurrentStore();
  const groups = useStoreAreasRooms(store.id);
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [fileName, setFileName] = useState("");

  const downloadTemplate = async () => {
    const XLSX = await import("xlsx");
    const sample = [
      [...HEADERS],
      ["山田 花子", "やまだ はなこ", "090-1111-2222", groups[0]?.area.name ?? "", "", BRANDS.find((b) => b.id === store.brandIds[0])?.name ?? "", "ハナ", "", ""],
      ["佐藤 一郎", "さとう いちろう", "080-3333-4444", groups[1]?.area.name ?? groups[0]?.area.name ?? "", groups[0]?.rooms[0]?.name ?? "", BRANDS.find((b) => b.id === store.brandIds[0])?.name ?? "", "イチ", BRANDS.find((b) => b.id === store.brandIds[1])?.name ?? "", "ロウ"],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sample);
    ws["!cols"] = HEADERS.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "名簿");
    XLSX.writeFile(wb, "名簿テンプレート.xlsx");
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
    const areaNames = groups.map((g) => g.area.name);
    const roomNames = groups.flatMap((g) => g.rooms.map((r) => r.name));
    const brandNames = BRANDS.map((b) => b.name);
    const rows: PreviewRow[] = json.map((r) => {
      const values = Object.fromEntries(HEADERS.map((h) => [h, String(r[h] ?? "").trim()])) as PreviewRow["values"];
      const errors: string[] = [];
      if (!values["氏名"]) errors.push("氏名が空です");
      if (values["主担当エリア"] && !areaNames.includes(values["主担当エリア"])) errors.push("エリア名が見つかりません");
      if (values["固定部屋"] && !roomNames.includes(values["固定部屋"])) errors.push("部屋名が見つかりません");
      if (!values["ブランド1"] || !values["名義1"]) errors.push("名義1は必須です");
      for (const k of ["ブランド1", "ブランド2"] as const) if (values[k] && !brandNames.includes(values[k])) errors.push(`${k}が不明です`);
      return { values, errors };
    });
    setFileName(file.name);
    setPreview(rows);
  };

  const ok = preview?.filter((r) => r.errors.length === 0) ?? [];

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">手順</CardTitle>
          <CardDescription>テンプレートに記入してアップロード → 内容を確認 → 取込</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button variant="outline" onClick={downloadTemplate}><Download /> 1. テンプレートをダウンロード</Button>
          <label className="border-primary/40 bg-primary/5 flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-3 text-center text-sm">
            <FileUp className="text-primary size-6" />
            2. Excel(.xlsx) / CSV を選択
            {fileName && <span className="text-muted-foreground text-xs">{fileName}</span>}
            <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
          <Button
            disabled={!ok.length}
            onClick={() => {
              const n = repo.staff.bulkImport(
                ok.map(({ values: v }) => {
                  const area = groups.find((g) => g.area.name === v["主担当エリア"])?.area ?? groups[0].area;
                  const room = groups.flatMap((g) => g.rooms).find((r) => r.name === v["固定部屋"]);
                  const aliases = ([["ブランド1", "名義1"], ["ブランド2", "名義2"]] as const)
                    .filter(([b, n]) => v[b] && v[n])
                    .map(([b, n]) => ({ brandId: BRANDS.find((x) => x.name === v[b])!.id, displayName: v[n] }));
                  return { storeId: store.id, name: v["氏名"], kana: v["ふりがな"], phone: v["電話番号"], homeAreaId: area.id, fixedRoomId: room?.id, joinedAt: todayStr(), active: true, aliases };
                }),
              );
              toast.success(`${n}名を登録しました`);
              setPreview(null);
              setFileName("");
            }}
          >
            <UserPlus /> 3. {ok.length}名を取り込む
          </Button>
          <p className="text-muted-foreground text-xs">エラーのある行は取り込まれません。</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">プレビュー {preview && <span className="text-muted-foreground text-sm font-normal">({preview.length}行 / 取込可 {ok.length}行)</span>}</CardTitle>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <p className="text-muted-foreground py-10 text-center text-sm">ファイルを選択するとここに内容が表示されます</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>状態</TableHead>
                  {HEADERS.map((h) => (
                    <TableHead key={h}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((r, i) => (
                  <TableRow key={i} className={r.errors.length ? "bg-rose-50" : undefined}>
                    <TableCell>{r.errors.length ? <Badge variant="destructive" title={r.errors.join("\n")}>{r.errors[0]}</Badge> : <Badge variant="success">OK</Badge>}</TableCell>
                    {HEADERS.map((h) => (
                      <TableCell key={h} className="whitespace-nowrap">{r.values[h]}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
