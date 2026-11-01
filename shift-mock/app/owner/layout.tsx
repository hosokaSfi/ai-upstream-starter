import { AdminShell } from "@/components/admin-shell";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell ownerOnly>{children}</AdminShell>;
}
