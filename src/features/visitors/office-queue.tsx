import Link from "next/link";
import { db } from "@/lib/db";
import { Avatar, Badge, Card, CardHeader, EmptyState, Metric } from "@/components/ui";
import { PH_TZ } from "@/lib/ph-time";
import { manilaDayBounds, todayIso } from "@/lib/registration";
import { ArrowRight, Clock } from "lucide-react";

function timeLabel(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleTimeString("en-PH", {
    timeZone: PH_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

function elapsed(from: Date): string {
  const minutes = Math.max(0, Math.floor((Date.now() - from.getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

/** Live queue and current visitor transactions for one office. */
export async function OfficeQueue({ departmentId }: { departmentId: string }) {
  const { start, end } = manilaDayBounds(todayIso());

  const [queue, onSite] = await Promise.all([
    db.visit.findMany({
      where: {
        status: "PENDING",
        AND: [
          { OR: [{ departmentId }, { stops: { some: { departmentId } } }] },
          {
            OR: [
              { expectedArrival: { gte: start, lt: end } },
              { expectedArrival: null, createdAt: { gte: start, lt: end } },
            ],
          },
        ],
      },
      orderBy: [{ expectedArrival: "asc" }, { createdAt: "asc" }],
      take: 50,
      select: {
        id: true,
        expectedArrival: true,
        hostName: true,
        visitor: { select: { id: true, firstName: true, lastName: true, company: true } },
      },
    }),
    db.visitStop.findMany({
      where: {
        departmentId,
        checkedInAt: { not: null },
        checkedOutAt: null,
        visit: { status: "CHECKED_IN" },
      },
      orderBy: { checkedInAt: "asc" },
      take: 50,
      select: {
        id: true,
        checkedInAt: true,
        visit: {
          select: {
            id: true,
            hostName: true,
            visitor: { select: { id: true, firstName: true, lastName: true, company: true } },
          },
        },
      },
    }),
  ]);

  return (
    <Card>
      <CardHeader
        title="Incoming & in queue"
        subtitle="Visitors expected today and current transactions at your office"
      />

      <div className="flex flex-col divide-y divide-[var(--border)] border-b border-[var(--border)] sm:flex-row sm:divide-x sm:divide-y-0">
        <Metric label="In queue" value={queue.length} hint="Registered and waiting to arrive." />
        <Metric label="In office now" value={onSite.length} hint="Currently at your office." />
      </div>

      <div className="grid gap-0 divide-y divide-[var(--border)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
        <section>
          <p className="border-b border-[var(--border)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            In queue
          </p>
          {queue.length === 0 ? (
            <EmptyState title="No one in queue" hint="New arrivals for your office appear here." />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {queue.map((visit) => {
                const name = `${visit.visitor.firstName} ${visit.visitor.lastName}`;
                return (
                  <li key={visit.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {visit.visitor.company ?? "Walk-in"} · Host: {visit.hostName ?? "Any"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge tone="amber">Expected</Badge>
                      <p className="mt-1 text-xs tabular-nums text-[var(--muted)]">
                        {timeLabel(visit.expectedArrival)}
                      </p>
                    </div>
                    <Link
                      href={`/staff/visitors/${visit.visitor.id}`}
                      className="text-[var(--brand)] hover:underline"
                      aria-label={`Open ${name}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <p className="border-b border-[var(--border)] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
            Current transactions
          </p>
          {onSite.length === 0 ? (
            <EmptyState title="No visitors in office" hint="Visitors checked in at your office appear here." />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {onSite.map((stop) => {
                const name = `${stop.visit.visitor.firstName} ${stop.visit.visitor.lastName}`;
                return (
                  <li key={stop.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        Host: {stop.visit.hostName ?? "Any"}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge tone="green">In office</Badge>
                      <p className="mt-1 flex items-center justify-end gap-1 text-xs tabular-nums text-[var(--muted)]">
                        <Clock className="h-3 w-3" />
                        {stop.checkedInAt ? elapsed(stop.checkedInAt) : "—"}
                      </p>
                    </div>
                    <Link
                      href={`/staff/visitors/${stop.visit.visitor.id}`}
                      className="text-[var(--brand)] hover:underline"
                      aria-label={`Open ${name}`}
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
