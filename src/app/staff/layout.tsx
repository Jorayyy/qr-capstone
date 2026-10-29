import { AppShell } from "@/components/AppShell";
import { requirePortal } from "@/lib/portal-server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortal("staff");

  return (
    <AppShell userName={session.name} userRole={session.role} portal="staff">
      {children}
    </AppShell>
  );
}
