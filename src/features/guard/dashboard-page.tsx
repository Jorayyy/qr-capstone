import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { DashboardOverview } from "@/components/dashboard-overview";
import { PH_TZ } from "@/lib/ph-time";
import { QrCode, UserPlus } from "lucide-react";

export default async function GuardDashboardPage() {
  await requirePermission("visit:read");

  const todayLabel = new Date().toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={todayLabel}
        actions={
          <div className="flex gap-2">
            <Link href="/guard">
              <Button>
                <QrCode className="h-4 w-4" />
                Scan QR
              </Button>
            </Link>
            <Link href="/guard/visitors/register">
              <Button variant="secondary">
                <UserPlus className="h-4 w-4" />
                Register Walk-in
              </Button>
            </Link>
          </div>
        }
      />

      <DashboardOverview portal="guard" />
    </div>
  );
}
