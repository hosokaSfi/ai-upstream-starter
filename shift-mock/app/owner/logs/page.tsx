"use client";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/date";
import { useData } from "@/lib/store";
import type { Role } from "@/lib/types";

const ROLE: Record<Role, { label: string; v: "secondary" | "default" | "outline" }> = {
  staff: { label: "スタッフ", v: "outline" },
  admin: { label: "管理者", v: "secondary" },
  owner: { label: "オーナー", v: "default" },
};

export default function LogsPage() {
  const logs = useData((d) => d.logs);
  const stores = useData((d) => d.stores);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | Role>("");
  const list = useMemo(
    () => logs.filter((l) => (!role || l.role === role) && (!q || `${l.actorName}${l.action}${l.detail}`.includes(q))),
    [logs, q, role],
  );
  return (
    <div>
      <PageHeader title="操作履歴" description="このモック内での操作(ログイン・配置変更・設定変更など)を実際に記録しています。最新500件。" />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative w-full sm:w-72">
          <Search className="text-muted-foreground absolute top-1/2 left-2 size-4 -translate-y-1/2" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="誰が・何を で検索" className="pl-8" />
        </div>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value as "" | Role)} className="w-36">
          <option value="">すべての役割</option>
          <option value="staff">スタッフ</option>
          <option value="admin">管理者</option>
          <option value="owner">オーナー</option>
        </NativeSelect>
      </div>
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>いつ</TableHead>
              <TableHead>誰が</TableHead>
              <TableHead>店舗</TableHead>
              <TableHead>何を</TableHead>
              <TableHead>詳細</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap tabular-nums">{formatDateTime(l.at)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant={ROLE[l.role].v} className="mr-1">{ROLE[l.role].label}</Badge>
                  {l.actorName}
                </TableCell>
                <TableCell className="text-xs whitespace-nowrap">{stores.find((s) => s.id === l.storeId)?.name}</TableCell>
                <TableCell className="font-medium whitespace-nowrap">{l.action}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{l.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
