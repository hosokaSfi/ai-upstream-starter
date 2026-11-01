"use client";
import { useRouter } from "next/navigation";
import { Building2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { repo } from "@/lib/repositories";
import type { Role } from "@/lib/types";

const ENTRIES: { role: Role; label: string; desc: string; href: string; icon: React.ReactNode }[] = [
  { role: "staff", label: "スタッフとして入る", desc: "シフト希望・確定シフト・入退室報告(スマホ向け)", href: "/staff", icon: <UserRound /> },
  { role: "admin", label: "管理者として入る", desc: "配置ボード・スタッフ管理(PC/タブレット向け)", href: "/admin", icon: <Building2 /> },
  { role: "owner", label: "オーナーとして入る", desc: "管理者権限・操作履歴・店舗設定も利用可", href: "/admin", icon: <ShieldCheck /> },
];

export default function LoginPage() {
  const router = useRouter();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="space-y-2 text-center">
        <div className="bg-primary text-primary-foreground mx-auto flex size-14 items-center justify-center rounded-2xl text-xl font-bold">シ</div>
        <h1 className="text-2xl font-bold">シフト・部屋管理</h1>
        <p className="text-muted-foreground text-sm">操作確認用モック(認証なし・データはこの端末内に保存)</p>
      </div>
      <div className="flex flex-col gap-3">
        {ENTRIES.map((e) => (
          <Button
            key={e.role}
            variant={e.role === "staff" ? "default" : "outline"}
            className="h-auto justify-start gap-4 px-4 py-4 text-left"
            onClick={() => {
              repo.auth.login(e.role);
              router.push(e.href);
            }}
          >
            <span className="[&_svg]:size-6">{e.icon}</span>
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">{e.label}</span>
              <span className="text-xs font-normal whitespace-normal opacity-80">{e.desc}</span>
            </span>
          </Button>
        ))}
      </div>
      <p className="text-muted-foreground text-center text-xs">本番ではメールアドレス+パスワード等でログインします</p>
    </main>
  );
}
