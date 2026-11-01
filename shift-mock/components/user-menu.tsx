"use client";
import { useRouter } from "next/navigation";
import { LogOut, RotateCcw } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { repo } from "@/lib/repositories";
import { useData, useSession } from "@/lib/store";
import { cn } from "@/lib/utils";

const ROLE_LABEL = { staff: "スタッフ", admin: "管理者", owner: "オーナー" } as const;

export function UserMenu({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const session = useSession();
  const staff = useData((d) => d.staff);
  const admins = useData((d) => d.admins);
  const name =
    session.role === "staff"
      ? staff.find((s) => s.id === session.staffId)?.name
      : admins.find((a) => a.id === (session.role === "owner" ? "owner" : session.adminId))?.name;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="hover:bg-accent flex min-h-11 items-center gap-2 rounded-md px-2 text-left text-sm outline-none">
        <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full text-xs font-bold">{name?.slice(0, 1)}</span>
        <span className={cn("flex flex-col leading-tight", compact && "hidden sm:flex")}>
          <span className="font-medium">{name}</span>
          <span className="text-muted-foreground text-[11px]">{session.role ? ROLE_LABEL[session.role] : ""}</span>
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="bg-popover z-50 min-w-52 rounded-lg border p-1 text-sm shadow-md">
          <DropdownMenu.Label className="text-muted-foreground px-2 py-1.5 text-xs">デモ操作</DropdownMenu.Label>
          <DropdownMenu.Item
            className="hover:bg-accent flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 outline-none"
            onSelect={() => {
              if (confirm("この端末のデモデータを初期状態に戻します。よろしいですか?")) {
                repo.resetDemo();
                router.replace("/");
              }
            }}
          >
            <RotateCcw className="size-4" /> デモデータを初期化
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border my-1 h-px" />
          <DropdownMenu.Item
            className="hover:bg-accent flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-2 outline-none"
            onSelect={() => {
              repo.auth.logout();
              router.replace("/");
            }}
          >
            <LogOut className="size-4" /> ログアウト
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
