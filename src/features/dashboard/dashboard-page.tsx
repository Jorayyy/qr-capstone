import Link from "next/link";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Button } from "@/components/ui";
import { DashboardOverview } from "@/components/dashboard-overview";
import { isDashboardPeriod, type DashboardPeriod } from "@/lib/reports";
import { PH_TZ } from "@/lib/ph-time";
import { QrCode } from "lucide-react";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePermission("visit:read");

  const { period: rawPeriod } = await searchParams;
  const period: DashboardPeriod = isDashboardPeriod(rawPeriod) ? rawPeriod : "day";

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
          <Link href="/admin/scanner">
            <Button variant="secondary">
              <QrCode className="h-4 w-4" />
              Scan QR
            </Button>
          </Link>
        }
      />

      <DashboardOverview period={period} />
    </div>
  );
}
