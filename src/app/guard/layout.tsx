import { AppShell } from "@/components/AppShell";
import { requirePortal } from "@/lib/portal-server";

export default async function GuardLayout({ children }: { children: React.ReactNode }) {
  const session = await requirePortal("guard");

  return (
    <AppShell userName={session.name} userRole={session.role} portal="guard">
      {children}
    </AppShell>
  );
}
