import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { MyOfficeVisitors } from "@/features/visitors/my-office-visitors";
import { PH_TZ } from "@/lib/ph-time";
import { QrCode, Plus } from "lucide-react";

export default async function StaffDashboardPage() {
  const user = await requirePermission("visit:read");
  const profile = await db.user.findUnique({
    where: { id: user.userId },
    select: { departmentId: true },
  });

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

      <MyOfficeVisitors departmentId={profile?.departmentId ?? null} />
    </div>
  );
}
