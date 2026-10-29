import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, EmptyState, Avatar, cx } from "@/components/ui";
import { RelativeTime } from "@/components/relative-time";
import { manilaMidnight, manilaParts } from "@/lib/ph-time";
import { ArrowRight, Building2, CalendarClock, CheckCircle2, Users } from "lucide-react";

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Pending",
  CHECKED_IN: "Inside",
  CHECKED_OUT: "Checked out",
  CANCELLED: "Cancelled",
};

const STATUS_DOT: Record<string, string> = {
  PENDING: "bg-[var(--warning)]",
  CHECKED_IN: "bg-[var(--success)]",
  CHECKED_OUT: "bg-[var(--border-strong)]",
  CANCELLED: "bg-[var(--danger)]",
};



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

/** Shared visitor overview — identical for every role and reused by /dashboard and /security. */
export async function DashboardOverview() {
  const nowParts = manilaParts(new Date());
  const today = manilaMidnight(nowParts.year, nowParts.month, nowParts.day);
  const tomorrow = manilaMidnight(nowParts.year, nowParts.month, nowParts.day + 1);

  const [
    totalToday,
    pending,
    totalAll,
    inCampus,
    visited,
    todaysVisits,
    openStops,
    recentVisits,
  ] = await Promise.all([
      db.visit.count({ where: { createdAt: { gte: today } } }),
      db.visit.count({ where: { status: "PENDING" } }),
      db.visit.count(),
      db.visit.count({ where: { status: "CHECKED_IN" } }),
      db.visit.count({ where: { status: "CHECKED_OUT" } }),
      db.visit.findMany({
        where: { createdAt: { gte: today, lt: tomorrow } },
        select: { actualArrival: true, createdAt: true },
      }),
      db.visitStop.findMany({
        where: { checkedInAt: { not: null }, checkedOutAt: null },
        select: { department: { select: { name: true } } },
      }),
      db.visit.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { visitor: true, department: true },
      }),
    ]);

  const buckets = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => ({
    hour: DAY_START_HOUR + i,
    count: 0,
  }));
  for (const visit of todaysVisits) {
    const at = visit.actualArrival ?? visit.createdAt;
    const hour = manilaParts(at).hour;
    const bucket = buckets.find((b) => b.hour === hour);
    if (bucket) bucket.count += 1;
  }
  const peakIndex = buckets.reduce(
    (best, b, i) => (b.count > buckets[best].count ? i : best),
    0
  );

  const occupancyMap = new Map<string, number>();
  for (const stop of openStops) {
    const name = stop.department?.name ?? "Unassigned";
    occupancyMap.set(name, (occupancyMap.get(name) ?? 0) + 1);
  }
  const occupancy = [...occupancyMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const occupancyMax = Math.max(1, ...occupancy.map((o) => o.count));

  return (
    <>
      <Card className="mb-6 overflow-hidden">
        <div className="grid grid-cols-1 gap-px bg-[var(--border)] sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <Users className="h-5 w-5 text-[var(--muted)]" />
              <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--muted)]">
                All registrations
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{totalAll}</p>
            <p className="mt-1 text-sm font-semibold">Registered Visitors</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">All visitor registrations to date.</p>
          </div>
          <div className="bg-[var(--surface)] p-5">
            <div className="flex items-start justify-between gap-2">
              <Building2 className="h-5 w-5 text-[var(--muted)]" />
              <span className="rounded-md bg-[var(--success-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--success)]">
                Active
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
                Completed
              </span>
            </div>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-[var(--foreground)]">{visited}</p>
            <p className="mt-1 text-sm font-semibold">Visited</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">Visits that have been completed.</p>
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
            <p className="mt-0.5 text-xs text-[var(--muted)]">Expected visitors who have not yet checked in.</p>
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Arrivals by hour" subtitle={`07:00 – 19:00 · ${totalToday} today`} />
          <div className="p-5">
            {totalToday === 0 ? (
              <EmptyState
                title="No arrivals yet"
                hint="The chart fills in as visitors are checked in today."
              />
            ) : (
              <ArrivalsChart buckets={buckets} peakIndex={peakIndex} />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Inside right now" subtitle="By destination office" />
          <div className="divide-y divide-[var(--border)]">
            {occupancy.length === 0 ? (
              <EmptyState title="Building is empty" hint="Open visit stops appear here." />
            ) : (
              occupancy.map((o) => (
                <div key={o.name} className="px-5 py-3.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium">{o.name}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{o.count}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${Math.round((o.count / occupancyMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent visits"
          subtitle="Latest 10 registrations"
          action={
            <Link
              href="/admin/visitors"
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
          <div className="overflow-x-auto">
            <table className="data-table min-w-[680px]">
              <thead>
                <tr>
                  <th className="px-5 py-2.5 font-semibold">Visitor</th>
                  <th className="px-5 py-2.5 font-semibold">Destination</th>
                  <th className="px-5 py-2.5 font-semibold">Purpose</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold">Registered</th>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map((v) => (
                  <tr key={v.id}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/visitors/${v.visitor.id}`} className="flex items-center gap-3">
                        <Avatar name={`${v.visitor.firstName} ${v.visitor.lastName}`} />
                        <span className="font-medium">{`${v.visitor.firstName} ${v.visitor.lastName}`}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">{v.department.name}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">{v.purpose.replace("_", " ")}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className={cx("h-2 w-2 rounded-full", STATUS_DOT[v.status] ?? "bg-[var(--border-strong)]")} />
                        <span className="text-sm">{STATUS_TEXT[v.status] ?? v.status}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      <RelativeTime value={v.createdAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
