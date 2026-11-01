"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarPlus, Camera, Home, Siren } from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { StoreSwitcher } from "@/components/store-switcher";
import { UserMenu } from "@/components/user-menu";
import { useFineBalance, useMe } from "@/lib/hooks";
import { cn, yen } from "@/lib/utils";

const TABS = [
  { href: "/staff", label: "ホーム", icon: Home },
  { href: "/staff/requests", label: "希望提出", icon: CalendarPlus },
  { href: "/staff/shifts", label: "シフト", icon: CalendarCheck },
  { href: "/staff/report", label: "入退室", icon: Camera },
  { href: "/staff/absence", label: "休み連絡", icon: Siren },
];

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <RoleGuard allow={["staff"]}>
      <div className="bg-muted/40 mx-auto flex min-h-dvh max-w-xl flex-col">
        <header className="bg-background/95 sticky top-0 z-30 flex items-center gap-2 border-b px-3 py-1.5 backdrop-blur">
          <StoreSwitcher className="w-28" />
          <div className="flex-1" />
          <FineBadge />
          <UserMenu />
        </header>
        <main className="flex-1 px-3 pt-3 pb-24">{children}</main>
        <nav className="bg-background pb-safe fixed inset-x-0 bottom-0 z-30 border-t">
          <ul className="mx-auto grid max-w-xl grid-cols-5">
            {TABS.map((t) => {
              const active = t.href === "/staff" ? pathname === "/staff" : pathname.startsWith(t.href);
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    className={cn(
                      "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px]",
                      active ? "text-primary font-semibold" : "text-muted-foreground",
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <t.icon className="size-5" />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </RoleGuard>
  );
}

/** 罰金残金はヘッダーに常時表示 */
function FineBadge() {
  const me = useMe();
  const balance = useFineBalance(me.id);
  if (balance <= 0) return null;
  return (
    <Link href="/staff#fine" className="rounded-md bg-rose-50 px-2 py-1 text-[11px] leading-tight text-rose-800">
      罰金残金
      <br />
      <b className="text-sm">{yen(balance)}</b>
    </Link>
  );
}
