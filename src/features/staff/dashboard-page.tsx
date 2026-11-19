import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PageHeader, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { MyOfficeVisitors } from "@/features/visitors/my-office-visitors";
import { OfficeQueue } from "@/features/visitors/office-queue";
import { OfficeStatusControl } from "@/features/departments/status-control";
import { AutoRefresh } from "@/components/auto-refresh";
import { AutoCheckoutNotice } from "@/components/auto-checkout-notice";
import { autoCheckOutOverdueVisits } from "@/lib/auto-checkout";
import { VisitorCharts } from "@/components/visitor-charts";
import { PH_TZ } from "@/lib/ph-time";
import { QrCode } from "lucide-react";

export default async function StaffDashboardPage() {
  const user = await requirePermission("visit:read");
  await autoCheckOutOverdueVisits();
  const profile = await db.user.findUnique({
    where: { id: user.userId },
    select: {
      departmentId: true,
      department: {
        select: {
          id: true,
          name: true,
          building: true,
          officeOpen: true,
          headInOffice: true,
          statusUpdatedAt: true,
          statusUpdatedBy: true,
        },
      },
    },
  });
  const departmentId = profile?.departmentId ?? null;
  const department = profile?.department ?? null;

  const todayLabel = new Date().toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <PageHeader
        title="Dashboard"
        subtitle={todayLabel}
        actions={
          <Link href="/staff/scanner">
            <Button variant="secondary">
              <QrCode className="h-4 w-4" />
              Scan QR
            </Button>
          </Link>
        }
      />

      <AutoCheckoutNotice />

      {department ? (
        <Card>
          <CardHeader
            title="Office status"
            subtitle={`${department.name}${department.building ? ` · ${department.building}` : ""}`}
          />
          <div className="space-y-3 p-5">
            <OfficeStatusControl
              departmentId={department.id}
              officeOpen={department.officeOpen}
              headInOffice={department.headInOffice}
            />
            <p className="text-xs text-[var(--muted)]">
              {department.officeOpen
                ? "Visitors see this office as open."
                : "Visitors see this office as closed."}{" "}
              {department.headInOffice
                ? "The head of office is in."
                : "The head of office is out — the system shows a notice."}
            </p>
            {department.statusUpdatedAt && (
              <p className="text-xs text-[var(--muted)]">
                Last updated {department.statusUpdatedAt.toLocaleString("en-PH", {
                  timeZone: PH_TZ,
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {department.statusUpdatedBy ? ` by ${department.statusUpdatedBy}` : ""}
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHeader title="Office status" subtitle="No office assigned" />
          <EmptyState
            title="No office assigned"
            hint="Ask an administrator to set your office in Admin → Security → Users."
          />
        </Card>
      )}

      {departmentId ? <OfficeQueue departmentId={departmentId} /> : null}

      <VisitorCharts departmentId={departmentId} />

      <MyOfficeVisitors departmentId={departmentId} />
    </div>
  );
}
