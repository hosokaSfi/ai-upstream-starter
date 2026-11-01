"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Bell, Building, CalendarRange, ClipboardCheck, FileSpreadsheet, History, LayoutGrid, Menu, Settings2,
  SlidersHorizontal, UserCog, Users, Contact, Flame,
} from "lucide-react";
import { RoleGuard } from "@/components/role-guard";
import { StoreSwitcher } from "@/components/store-switcher";
import { UserMenu } from "@/components/user-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useData, useSession } from "@/lib/store";
import type { PermissionKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; perm?: PermissionKey; owner?: boolean };

export const ADMIN_NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "シフト",
    items: [
      { href: "/admin", label: "配置ボード", icon: LayoutGrid, perm: "board" },
      { href: "/admin/requests", label: "希望の集計", icon: CalendarRange, perm: "requests" },
      { href: "/admin/sheets", label: "スプレッドシート連携", icon: FileSpreadsheet, perm: "sheets" },
    ],
  },
  {
    group: "スタッフ",
    items: [
      { href: "/admin/staff", label: "スタッフ一覧", icon: Users, perm: "staffList" },
      { href: "/admin/score", label: "スコア設定", icon: SlidersHorizontal, perm: "score" },
      { href: "/admin/alerts", label: "アラート設定", icon: Flame, perm: "alerts" },
      { href: "/admin/roster", label: "名簿管理", icon: Contact, perm: "roster" },
      { href: "/admin/notices", label: "お知らせ・罰金", icon: Bell, perm: "notices" },
    ],
  },
  {
    group: "部屋",
    items: [
      { href: "/admin/rooms", label: "部屋管理", icon: Building, perm: "rooms" },
      { href: "/admin/reports", label: "入退室報告の確認", icon: ClipboardCheck, perm: "reports" },
    ],
  },
  {
    group: "オーナー",
    items: [
      { href: "/owner/admins", label: "管理者・権限", icon: UserCog, owner: true },
      { href: "/owner/logs", label: "操作履歴", icon: History, owner: true },
      { href: "/owner/settings", label: "店舗・セキュリティ設定", icon: Settings2, owner: true },
    ],
  },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const session = useSession();
  const admins = useData((d) => d.admins);
  const me = admins.find((a) => a.id === (session.role === "owner" ? "owner" : session.adminId));
  const isOwner = session.role === "owner";
  return (
    <nav className="flex flex-col gap-4 p-3 text-sm">
      {ADMIN_NAV.map((g) => {
        const items = g.items.filter((i) => (i.owner ? isOwner : isOwner || (i.perm && me?.permissions.includes(i.perm))));
        if (!items.length) return null;
        return (
          <div key={g.group} className="flex flex-col gap-0.5">
            <div className="text-muted-foreground px-2 pb-1 text-[11px] font-semibold tracking-wide">{g.group}</div>
            {items.map((i) => {
              const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex min-h-10 items-center gap-2.5 rounded-md px-2",
                    active ? "bg-primary text-primary-foreground" : "hover:bg-accent text-foreground/80",
                  )}
                >
                  <i.icon className="size-4" />
                  {i.label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function AdminShell({ children, ownerOnly }: { children: React.ReactNode; ownerOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <RoleGuard allow={ownerOnly ? ["owner"] : ["admin", "owner"]}>
      <div className="flex min-h-dvh">
        <aside className="bg-background sticky top-0 hidden h-dvh w-56 shrink-0 overflow-y-auto border-r lg:block print:hidden">
          <div className="flex h-14 items-center gap-2 border-b px-4 font-bold">
            <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-md text-sm">シ</span>
            シフト・部屋管理
          </div>
          <NavList />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="bg-background/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur print:hidden">
            <button className="hover:bg-accent flex size-11 items-center justify-center rounded-md lg:hidden" onClick={() => setOpen(true)} aria-label="メニュー">
              <Menu className="size-5" />
            </button>
            <StoreSwitcher className="w-32" />
            <div className="flex-1" />
            <UserMenu compact />
          </header>
          <main className="min-w-0 flex-1 p-3 md:p-5">{children}</main>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="overflow-y-auto">
            <SheetTitle className="border-b px-4 py-4 font-bold">メニュー</SheetTitle>
            <NavList onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </RoleGuard>
  );
}
