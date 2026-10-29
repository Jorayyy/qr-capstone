import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { DashboardOverview } from "@/components/dashboard-overview";
import { PH_TZ } from "@/lib/ph-time";
import { QrCode, Plus } from "lucide-react";

export default async function StaffDashboardPage() {
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
            <Link href="/staff/visitors/register">
              <Button>
                <Plus className="h-4 w-4" />
                Register Visitor
              </Button>
            </Link>
            <Link href="/staff/scanner">
              <Button variant="secondary">
                <QrCode className="h-4 w-4" />
                Scan QR
              </Button>
            </Link>
          </div>
        }
      />

      <DashboardOverview portal="staff" />
    </div>
  );
}
