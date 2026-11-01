"use client";
import { NativeSelect } from "@/components/ui/native-select";
import { repo } from "@/lib/repositories";
import { useData, useSession } from "@/lib/store";

export function StoreSwitcher({ className }: { className?: string }) {
  const stores = useData((d) => d.stores);
  const admins = useData((d) => d.admins);
  const staff = useData((d) => d.staff);
  const session = useSession();
  const me = admins.find((a) => a.id === (session.role === "owner" ? "owner" : session.adminId));
  const allowed = session.role === "staff" || !me ? stores : stores.filter((s) => me.storeIds.includes(s.id));
  return (
    <NativeSelect
      aria-label="店舗切替"
      className={className}
      value={session.storeId}
      onChange={(e) => {
        const id = e.target.value;
        if (session.role === "staff") {
          // デモ: スタッフ画面で店舗を切り替えたら、その店舗のスタッフ本人に切り替える
          const first = staff.find((s) => s.storeId === id && s.active);
          if (first) repo.auth.switchStaff(first.id);
        } else {
          repo.auth.switchStore(id);
        }
      }}
    >
      {allowed.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </NativeSelect>
  );
}
