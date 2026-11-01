"use client";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { repo } from "@/lib/repositories";
import { useData } from "@/lib/store";
import type { PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ALL_PERMISSIONS } from "@/mock/people";

export default function AdminsPage() {
  const admins = useData((d) => d.admins);
  const stores = useData((d) => d.stores);
  const [open, setOpen] = useState(false);
  const list = admins.filter((a) => a.role === "admin");

  const togglePerm = (id: string, perms: PermissionKey[], key: PermissionKey) =>
    repo.admins.update(id, { permissions: perms.includes(key) ? perms.filter((p) => p !== key) : [...perms, key] });

  return (
    <div>
      <PageHeader
        title="管理者アカウント・権限"
        description={`管理者 ${list.length}名(利用中 ${list.filter((a) => a.active).length}名)。権限は画面単位で付与します。`}
        actions={<Button onClick={() => setOpen(true)}><UserPlus /> 管理者を発行</Button>}
      />
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="bg-card sticky left-0 z-10">管理者</TableHead>
              <TableHead>担当店舗</TableHead>
              <TableHead>利用</TableHead>
              {ALL_PERMISSIONS.map((p) => (
                <TableHead key={p.key} className="text-center text-[11px] leading-tight whitespace-normal">{p.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((a) => (
              <TableRow key={a.id} className={cn(!a.active && "opacity-50")}>
                <TableCell className="bg-card sticky left-0 z-10 whitespace-nowrap">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-muted-foreground text-[11px]">{a.email}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {a.storeIds.map((id) => (<Badge key={id} variant="outline" className="mr-1">{stores.find((s) => s.id === id)?.name}</Badge>))}
                </TableCell>
                <TableCell>
                  <Switch checked={a.active} onCheckedChange={(v) => { repo.admins.update(a.id, { active: v }); toast.success(`${a.name}さんを${v ? "再開" : "停止"}しました`); }} aria-label="利用" />
                </TableCell>
                {ALL_PERMISSIONS.map((p) => (
                  <TableCell key={p.key} className="text-center">
                    <Checkbox checked={a.permissions.includes(p.key)} onCheckedChange={() => togglePerm(a.id, a.permissions, p.key)} aria-label={`${a.name} ${p.label}`} disabled={!a.active} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <IssueDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function IssueDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const stores = useData((d) => d.stores);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [storeIds, setStoreIds] = useState<string[]>([stores[0].id]);
  const [perms, setPerms] = useState<PermissionKey[]>(["board", "staffList", "requests"]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>管理者アカウントを発行</DialogTitle>
          <DialogDescription>本番では招待メールが送信され、本人がパスワードを設定します。</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5"><Label>氏名</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid gap-1.5"><Label>メールアドレス</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <div className="grid gap-1.5">
            <Label>担当店舗</Label>
            <div className="flex flex-wrap gap-3">
              {stores.map((s) => (
                <Label key={s.id} className="font-normal">
                  <Checkbox checked={storeIds.includes(s.id)} onCheckedChange={(v) => setStoreIds(v ? [...storeIds, s.id] : storeIds.filter((x) => x !== s.id))} />
                  {s.name}
                </Label>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>使える画面</Label>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map((p) => (
                <Label key={p.key} className="font-normal">
                  <Checkbox checked={perms.includes(p.key)} onCheckedChange={(v) => setPerms(v ? [...perms, p.key] : perms.filter((x) => x !== p.key))} />
                  {p.label}
                </Label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || !email.includes("@") || storeIds.length === 0}
            onClick={() => {
              repo.admins.add({ name: name.trim(), email, role: "admin", storeIds, permissions: perms, active: true });
              toast.success(`${name}さんのアカウントを発行しました(モック)`);
              setName(""); setEmail("");
              onOpenChange(false);
            }}
          >
            発行する
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
