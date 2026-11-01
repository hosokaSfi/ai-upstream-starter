"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/store";
import type { Role } from "@/lib/types";

/** モックの簡易ガード: 役割が合わなければログイン画面へ戻す */
export function RoleGuard({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { role } = useSession();
  const router = useRouter();
  const ok = role !== null && allow.includes(role);
  useEffect(() => {
    if (!ok) router.replace("/");
  }, [ok, router]);
  return ok ? <>{children}</> : null;
}
