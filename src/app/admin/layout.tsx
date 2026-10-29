import { AppShell } from "@/components/AppShell";
import { requirePortal } from "@/lib/portal-server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortal("admin");

  return (
    <AppShell userName={session.name} userRole={session.role} portal="admin">
      {children}
    </AppShell>
  );
}
