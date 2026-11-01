"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PermissionGate } from "@/components/permission-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { formatDateJa, formatDateTime, todayStr } from "@/lib/date";
import { useCurrentStore, useStoreStaff } from "@/lib/hooks";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import { yen } from "@/lib/utils";

export default function NoticesPage() {
  return (
    <PermissionGate perm="notices">
      <PageHeader title="お知らせ・申し送り・罰金" description="スタッフのホーム画面に表示される情報を登録します。" />
      <Tabs defaultValue="notice">
        <TabsList>
          <TabsTrigger value="notice">お知らせ</TabsTrigger>
          <TabsTrigger value="handover">個別の申し送り</TabsTrigger>
          <TabsTrigger value="fine">罰金残金</TabsTrigger>
        </TabsList>
        <TabsContent value="notice"><NoticeTab /></TabsContent>
        <TabsContent value="handover"><HandoverTab /></TabsContent>
        <TabsContent value="fine"><FineTab /></TabsContent>
      </Tabs>
    </PermissionGate>
  );
}

function NoticeTab() {
  const store = useCurrentStore();
  const notices = useData((d) => d.notices);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [onLogin, setOnLogin] = useState(false);
  const list = notices.filter((n) => n.storeId === store.id);
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader><CardTitle className="text-base">新規お知らせ({store.name})</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="タイトル" />
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="本文" rows={5} />
          <Label><Switch checked={onLogin} onCheckedChange={setOnLogin} /> ログイン時にポップアップ表示</Label>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              repo.comms.addNotice({ storeId: store.id, title: title.trim(), body, showOnLogin: onLogin });
              setTitle(""); setBody(""); setOnLogin(false);
              toast.success("お知らせを登録しました");
            }}
          >
            登録
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">登録済み</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {list.map((n) => (
            <div key={n.id} className="flex items-start gap-2 py-2.5">
              <div className="flex-1 text-sm">
                <div className="font-medium">{n.title} {n.showOnLogin && <Badge variant="warning">ログイン時表示</Badge>}</div>
                <p className="text-muted-foreground">{n.body}</p>
                <p className="text-muted-foreground text-xs">{formatDateTime(n.createdAt)}</p>
              </div>
              <Button variant="ghost" size="icon" aria-label="削除" onClick={() => repo.comms.removeNotice(n.id)}><Trash2 /></Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function HandoverTab() {
  const store = useCurrentStore();
  const staff = useStoreStaff(store.id);
  const handovers = useData((d) => d.handovers);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [body, setBody] = useState("");
  const list = handovers.filter((h) => h.storeId === store.id);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader><CardTitle className="text-base">個別の申し送り</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          <NativeSelect value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </NativeSelect>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="本人のホーム画面にだけ表示されます" rows={4} />
          <Button disabled={!body.trim()} onClick={() => { repo.comms.addHandover(store.id, staffId, body.trim()); setBody(""); toast.success("申し送りを登録しました"); }}>登録</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">送信済み</CardTitle></CardHeader>
        <CardContent className="flex flex-col divide-y">
          {list.map((h) => (
            <div key={h.id} className="py-2.5 text-sm">
              <div className="flex items-center gap-2 font-medium">{name(h.staffId)} 宛 {h.read ? <Badge variant="success">既読</Badge> : <Badge variant="outline">未読</Badge>}</div>
              <p className="text-muted-foreground">{h.body}</p>
              <p className="text-muted-foreground text-xs">{formatDateTime(h.createdAt)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FineTab() {
  const store = useCurrentStore();
  const staff = useStoreStaff(store.id);
  const fines = useData((d) => d.fines);
  const pays = useData((d) => d.finePayments);
  const [staffId, setStaffId] = useState(staff[0]?.id ?? "");
  const [amount, setAmount] = useState(1000);
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState<"fine" | "pay">("fine");
  const balances = useMemo(
    () =>
      staff
        .map((s) => {
          const f = fines.filter((x) => x.staffId === s.id).reduce((a, x) => a + x.amount, 0);
          const p = pays.filter((x) => x.staffId === s.id).reduce((a, x) => a + x.amount, 0);
          return { s, f, p, bal: f - p };
        })
        .filter((x) => x.f > 0)
        .sort((a, b) => b.bal - a.bal),
    [staff, fines, pays],
  );
  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">登録</CardTitle>
          <Tabs value={mode} onValueChange={(v) => setMode(v as "fine" | "pay")}>
            <TabsList className="w-full">
              <TabsTrigger value="fine">罰金を追加</TabsTrigger>
              <TabsTrigger value="pay">支払いを記録</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <NativeSelect value={staffId} onChange={(e) => setStaffId(e.target.value)}>
            {staff.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </NativeSelect>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} step={500} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            <span className="text-sm">円</span>
          </div>
          {mode === "fine" && <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="理由(例: 当日欠勤)" />}
          <Button
            disabled={amount <= 0 || (mode === "fine" && !reason.trim())}
            onClick={() => {
              if (mode === "fine") repo.comms.addFine({ staffId, amount, reason: reason.trim(), date: todayStr() });
              else repo.comms.addFinePayment({ staffId, amount, date: todayStr() });
              setReason("");
              toast.success("登録しました。スタッフのホーム画面に反映されます");
            }}
          >
            {mode === "fine" ? "罰金を登録" : "支払いを記録"}
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-base">残金一覧</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>スタッフ</TableHead>
                <TableHead className="text-right">罰金計</TableHead>
                <TableHead className="text-right">支払済</TableHead>
                <TableHead className="text-right">残金</TableHead>
                <TableHead>最新</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.map(({ s, f, p, bal }) => {
                const last = fines.filter((x) => x.staffId === s.id).sort((a, b) => b.date.localeCompare(a.date))[0];
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{yen(f)}</TableCell>
                    <TableCell className="text-right tabular-nums">{yen(p)}</TableCell>
                    <TableCell className={bal > 0 ? "text-right font-semibold text-rose-700 tabular-nums" : "text-right tabular-nums"}>{yen(bal)}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{last && `${formatDateJa(last.date)} ${last.reason}`}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
