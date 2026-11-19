import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, EmptyState, Avatar, Badge, cx } from "@/components/ui";
import { RelativeTime } from "@/components/relative-time";
import { AutoRefresh } from "@/components/auto-refresh";
import { VisitorCharts } from "@/components/visitor-charts";
import { PeriodFilter } from "@/components/period-filter";
import { AutoCheckoutNotice } from "@/components/auto-checkout-notice";
import { autoCheckOutOverdueVisits } from "@/lib/auto-checkout";
import { portalHref, type Portal } from "@/lib/portal";
import {
  DASHBOARD_PERIODS,
  DASHBOARD_PERIOD_LABELS,
  resolveDashboardRange,
  type DashboardPeriod,
} from "@/lib/reports";
import { ArrowRight, Building2, CalendarClock, CheckCircle2, Users } from "lucide-react";

const STATUS_BADGE: Record<string, { tone: "gray" | "green" | "red" | "amber"; label: string }> = {
  PENDING: { tone: "amber", label: "Pending" },
  CHECKED_IN: { tone: "green", label: "Inside" },
  CHECKED_OUT: { tone: "gray", label: "Checked out" },
  CANCELLED: { tone: "red", label: "Cancelled" },
};

const PURPOSE_LABEL: Record<string, string> = {
  ATTENDANCE: "Attendance",
  DELIVERY: "Delivery",
  INTERVIEW: "Interview",
  MEETING: "Meeting",
  SCHOOL_VISIT: "School visit",
  OTHER: "Other",
};

const MOBILE_LABEL =
  "mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] sm:hidden";



function ArrivalsChart({
  buckets,
  peakIndex,
}: {
  buckets: Array<{ hour: number; count: number }>;
  peakIndex: number;
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div>
      <div className="flex h-40 items-end gap-1.5">
        {buckets.map((b, i) => {
          const height = b.count ? `${Math.max(Math.round((b.count / max) * 100), 5)}%` : "2px";
          const isPeak = i === peakIndex && b.count > 0;
          return (
            <div key={b.hour} className="group flex h-full flex-1 items-end">
              <div
                style={{ height }}
                title={`${String(b.hour).padStart(2, "0")}:00 — ${b.count} arrival${b.count === 1 ? "" : "s"}`}
                className={cx(
                  "relative w-full rounded-t-sm transition-colors",
                  b.count
                    ? isPeak
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--brand)]/80 group-hover:bg-[var(--brand)]"
                    : "bg-[var(--border)]"
                )}
              >
                {b.count > 0 && (
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded-md bg-[var(--foreground)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white group-hover:block">
                    {b.count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 text-[10px] tabular-nums text-[var(--muted)]">
        {buckets.map((b) => (
          <div key={b.hour} className="flex-1 text-center">
            {b.hour % 2 === 0 ? String(b.hour).padStart(2, "0") : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shared visitor overview — reused by the admin, staff and guard dashboards. */
export async function DashboardOverview({
  portal = "admin",
  period = "day",
}: {
  portal?: Portal;
  period?: DashboardPeriod;
}) {
  const { start, end, label: rangeLabel } = resolveDashboardRange(period);
  const range = { gte: start, lt: end };

  await autoCheckOutOverdueVisits();

  const [
    pending,
    registered,
    inCampus,
    visited,
    hourly,
    openStops,
    deptVisitCounts,
    departments,
    recentVisits,
    officeNotices,
  ] = await Promise.all([
      db.visit.count({ where: { createdAt: range, status: "PENDING" } }),
      db.visit.count({ where: { createdAt: range } }),
      db.visit.count({ where: { status: "CHECKED_IN" } }),
      db.visit.count({ where: { createdAt: range, status: "CHECKED_OUT" } }),
      db.$queryRaw<Array<{ hour: number; count: number }>>`
        SELECT date_part('hour', COALESCE("actualArrival", "createdAt") + interval '8 hours')::int AS hour,
               count(*)::int AS count
        FROM visits
        WHERE "createdAt" >= ${start} AND "createdAt" < ${end}
        GROUP BY hour`,
      db.visitStop.findMany({
        where: { checkedInAt: { not: null }, checkedOutAt: null },
        select: { department: { select: { name: true } } },
      }),
      db.visit.groupBy({
        by: ["departmentId"],
        where: { createdAt: range },
        _count: { _all: true },
      }),
      db.department.findMany({ select: { id: true, name: true } }),
      db.visit.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { visitor: true, department: true },
      }),
      db.department.findMany({
        where: { isActive: true, OR: [{ officeOpen: false }, { headInOffice: false }] },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          officeOpen: true,
          headInOffice: true,
          statusUpdatedAt: true,
          statusUpdatedBy: true,
        },
      }),
    ]);

  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
  for (const row of hourly) buckets[row.hour].count = row.count;
  const totalInRange = buckets.reduce((sum, b) => sum + b.count, 0);
  const peakIndex = buckets.reduce(
    (best, b, i) => (b.count > buckets[best].count ? i : best),
    0
  );

  const insideMap = new Map<string, number>();
  for (const stop of openStops) {
    const name = stop.department?.name ?? "Unassigned";
    insideMap.set(name, (insideMap.get(name) ?? 0) + 1);
  }
  const deptNames = new Map(departments.map((d) => [d.id, d.name]));
  const rangeMap = new Map<string, number>();
  for (const row of deptVisitCounts) {
    const name = deptNames.get(row.departmentId) ?? "Unassigned";
    rangeMap.set(name, (rangeMap.get(name) ?? 0) + row._count._all);
  }
  const occupancy = [...new Set([...rangeMap.keys(), ...insideMap.keys()])]
    .map((name) => ({
      name,
      total: rangeMap.get(name) ?? 0,
      inside: insideMap.get(name) ?? 0,
    }))
    .sort((a, b) => b.total - a.total || b.inside - a.inside)
    .slice(0, 6);
  const occupancyMax = Math.max(1, ...occupancy.map((o) => o.total || o.inside));
  const visitorsHref = portalHref(portal, "/visitors");

  return (
    <>
      <AutoRefresh />
      <AutoCheckoutNotice className="mb-6" />
      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <Users className="h-5 w-5 text-[var(--muted)]" />
              <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                {rangeLabel}
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{registered}</p>
            <p className="mt-1 text-sm font-semibold">Registered Visitors</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Visitor registrations {rangeLabel.toLowerCase()}.</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <Building2 className="h-5 w-5 text-[var(--muted)]" />
              <span className="rounded-md bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                Live
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{inCampus}</p>
            <p className="mt-1 text-sm font-semibold">In Campus</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Visitors who have checked in but not yet checked out.</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <CheckCircle2 className="h-5 w-5 text-[var(--muted)]" />
              <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                {rangeLabel}
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{visited}</p>
            <p className="mt-1 text-sm font-semibold">Visited</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Visits completed {rangeLabel.toLowerCase()}.</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <CalendarClock className="h-5 w-5 text-[var(--muted)]" />
              <span className="rounded-md bg-[var(--warning-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--warning)]">
                Pending
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{pending}</p>
            <p className="mt-1 text-sm font-semibold">To Visit</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Expected visitors {rangeLabel.toLowerCase()} who have not checked in.</p>
          </div>
        </div>
      </Card>

      {officeNotices.length > 0 && (
        <Card className="mb-6">
          <CardHeader title="Office notices" subtitle="Offices reported closed or with the head out" />
          <ul className="divide-y divide-[var(--border)]">
            {officeNotices.map((office) => (
              <li key={office.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{office.name}</span>
                <Badge tone={office.officeOpen ? "green" : "red"}>
                  {office.officeOpen ? "Office open" : "Office closed"}
                </Badge>
                <Badge tone={office.headInOffice ? "brand" : "amber"}>
                  {office.headInOffice ? "Head in" : "Head out"}
                </Badge>
                <span className="text-xs text-[var(--muted)]">
                  {office.statusUpdatedAt ? <RelativeTime value={office.statusUpdatedAt} /> : "—"}
                  {office.statusUpdatedBy ? ` · ${office.statusUpdatedBy}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Arrivals by hour"
            subtitle={`${rangeLabel} · ${totalInRange} arrival${totalInRange === 1 ? "" : "s"}`}
            action={
              <PeriodFilter
                value={period}
                label="Arrival period"
                options={DASHBOARD_PERIODS.map((p) => ({ value: p, label: DASHBOARD_PERIOD_LABELS[p] }))}
              />
            }
          />
          <div className="p-5">
            {totalInRange === 0 ? (
              <EmptyState
                title="No arrivals yet"
                hint="The chart fills in as visitors are checked in."
              />
            ) : (
              <ArrivalsChart buckets={buckets} peakIndex={peakIndex} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Visits by office"
            subtitle={`By destination office · ${rangeLabel}`}
          />
          <div className="divide-y divide-[var(--border)]">
            {occupancy.length === 0 ? (
              <EmptyState title="No visits in this period" hint="Visits to each office appear here." />
            ) : (
              occupancy.map((o) => (
                <div key={o.name} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{o.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{o.total}</span>
                  </div>
                  {o.inside > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">{o.inside} inside now</p>
                  )}
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${Math.round(((o.total || o.inside) / occupancyMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <VisitorCharts />

      <Card>
        <CardHeader
          title="Recent visits"
          subtitle="Latest 10 registrations"
          action={
            <Link
              href={visitorsHref}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />
        {recentVisits.length === 0 ? (
          <EmptyState title="No visits yet" hint="Visits appear here once visitors are registered." />
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_6.5rem_7rem] items-center gap-4 border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)] sm:grid">
              <span>Visitor</span>
              <span>Destination</span>
              <span>Purpose</span>
              <span>Status</span>
              <span className="text-right">Registered</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {recentVisits.map((v) => {
                const name = `${v.visitor.firstName} ${v.visitor.lastName}`;
                const status = STATUS_BADGE[v.status] ?? { tone: "gray" as const, label: v.status };
                const purpose =
                  v.purpose === "OTHER" && v.purposeOther
                    ? v.purposeOther
                    : PURPOSE_LABEL[v.purpose] ?? v.purpose;
                const row = (
                  <div
                    title={`Visit ${v.referenceCode}`}
                    className="grid grid-cols-2 items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_6.5rem_7rem] sm:gap-4"
                  >
                    <div className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                      <Avatar name={name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{name}</p>
                        <p className="truncate text-xs text-[var(--muted)]">
                          {v.visitor.company ?? v.visitor.email ?? "—"}
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className={MOBILE_LABEL}>Destination</p>
                      <p className="truncate text-sm text-[var(--muted)]">{v.department.name}</p>
                    </div>
                    <div className="min-w-0">
                      <p className={MOBILE_LABEL}>Purpose</p>
                      <p className="truncate text-sm text-[var(--muted)]">{purpose}</p>
                    </div>
                    <div>
                      <p className={MOBILE_LABEL}>Status</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <div className="sm:text-right">
                      <p className={MOBILE_LABEL}>Registered</p>
                      <RelativeTime value={v.createdAt} className="text-xs text-[var(--muted)]" />
                    </div>
                  </div>
                );

                return (
                  <li key={v.id}>
                    {portal === "guard" ? (
                      row
                    ) : (
                      <Link
                        href={portalHref(portal, `/visitors/${v.visitor.id}`)}
                        className="block transition-colors hover:bg-[var(--surface-muted)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand)]"
                      >
                        {row}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}
