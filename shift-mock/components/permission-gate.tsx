"use client";
import { ShieldAlert } from "lucide-react";
import { useData, useSession } from "@/lib/store";
import type { PermissionKey } from "@/lib/types";

/** 画面単位の権限チェック(オーナーは常に可) */
export function PermissionGate({ perm, children }: { perm: PermissionKey; children: React.ReactNode }) {
  const session = useSession();
  const admins = useData((d) => d.admins);
  const me = admins.find((a) => a.id === session.adminId);
  if (session.role === "owner" || me?.permissions.includes(perm)) return <>{children}</>;
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 py-20 text-sm">
      <ShieldAlert className="size-8" />
      この画面を使う権限がありません。オーナーに権限付与を依頼してください。
    </div>
  );
}
