import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { PH_TZ } from "@/lib/ph-time";
import { manilaDayBounds, todayIso } from "@/lib/registration";
import { Badge, Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";

const STATUS: Record<string, { label: string; tone: "green" | "amber" | "gray" }> = {
  CHECKED_IN: { label: "Inside", tone: "green" },
  PENDING: { label: "Expected today", tone: "amber" },
  CHECKED_OUT: { label: "Checked out", tone: "gray" },
  CANCELLED: { label: "Cancelled", tone: "gray" },
};

function timeLabel(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleTimeString("en-PH", {
    timeZone: PH_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function GuardOnSitePage() {
  await requirePermission("visit:read");

  const { start, end } = manilaDayBounds(todayIso());
  const visits = await db.visit.findMany({
    where: {
      OR: [
        { status: "CHECKED_IN" },
        { status: "PENDING", validFrom: { gte: start, lte: end } },
      ],
    },
    orderBy: [{ actualArrival: "desc" }, { validFrom: "asc" }],
    take: 100,
    select: {
      id: true,
      status: true,
      purpose: true,
      actualArrival: true,
      validFrom: true,
      visitor: { select: { firstName: true, lastName: true } },
      department: { select: { name: true } },
    },
  });

  const today = new Date().toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <PageHeader title="On-site visitors" subtitle={today} />

      <Card>
        <CardHeader title={`${visits.length} visitor${visits.length === 1 ? "" : "s"}`} subtitle="Inside or expected today" />
        {visits.length === 0 ? (
          <EmptyState title="No visitors on site" hint="Checked-in and expected visitors appear here." />
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {visits.map((visit) => {
              const status = STATUS[visit.status] ?? STATUS.PENDING;
              return (
                <li key={visit.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {visit.visitor.firstName} {visit.visitor.lastName}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {visit.department.name} · {visit.purpose.replaceAll("_", " ").toLowerCase()}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    <p>{visit.status === "CHECKED_IN" ? "In" : "Expected"} {timeLabel(visit.actualArrival ?? visit.validFrom)}</p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
