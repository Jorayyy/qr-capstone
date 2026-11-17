import { db } from "@/lib/db";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { buildVisitorCharts } from "@/lib/visitor-charts";
import { manilaMidnight, manilaParts } from "@/lib/ph-time";

/** Last-7-day registration/arrival trend and today's purpose mix. */
export async function VisitorCharts({
  departmentId,
}: {
  departmentId?: string | null;
}) {
  if (departmentId === null) return null;

  const now = manilaParts(new Date());
  const tomorrow = manilaMidnight(now.year, now.month, now.day + 1);
  const weekStart = manilaMidnight(now.year, now.month, now.day - 6);

  const visits = await db.visit.findMany({
    where: {
      AND: [
        departmentId ? { OR: [{ departmentId }, { stops: { some: { departmentId } } }] } : {},
        {
          OR: [
            { createdAt: { gte: weekStart, lt: tomorrow } },
            { actualArrival: { gte: weekStart, lt: tomorrow } },
          ],
        },
      ],
    },
    select: {
      createdAt: true,
      actualArrival: true,
      purpose: true,
      purposeOther: true,
    },
  });

  const { days, purposes, todayTotal, weekTotal, trendMax } = buildVisitorCharts(visits);

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Visitor trend"
          subtitle="Last 7 days · registered vs checked in"
          action={
            <span className="flex items-center gap-3 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--brand)]" />
                Registered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[var(--success)]" />
                Checked in
              </span>
            </span>
          }
        />
        <div className="p-5">
          {weekTotal === 0 && days.every((day) => day.checkedIn === 0) ? (
            <EmptyState title="No visits yet" hint="The chart fills in as visits are registered." />
          ) : (
            <>
              <div className="flex h-40 items-end gap-2">
                {days.map((day) => (
                  <div
                    key={day.key}
                    className="group flex h-full flex-1 items-end gap-1"
                    title={`${day.full} — ${day.registered} registered, ${day.checkedIn} checked in`}
                  >
                    <div
                      className={
                        day.registered
                          ? "w-1/2 rounded-t-sm bg-[var(--brand)]/80 transition-colors group-hover:bg-[var(--brand)]"
                          : "w-1/2 rounded-t-sm bg-[var(--surface-muted)]"
                      }
                      style={{
                        height: day.registered
                          ? `${Math.max(Math.round((day.registered / trendMax) * 100), 4)}%`
                          : "2px",
                      }}
                    />
                    <div
                      className={
                        day.checkedIn
                          ? "w-1/2 rounded-t-sm bg-[var(--success)]/80 transition-colors group-hover:bg-[var(--success)]"
                          : "w-1/2 rounded-t-sm bg-[var(--surface-muted)]"
                      }
                      style={{
                        height: day.checkedIn
                          ? `${Math.max(Math.round((day.checkedIn / trendMax) * 100), 4)}%`
                          : "2px",
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2 text-[10px] font-medium text-[var(--muted)]">
                {days.map((day) => (
                  <div key={day.key} className="flex-1 text-center">
                    {day.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Purpose today"
          subtitle={`${todayTotal} visit${todayTotal === 1 ? "" : "s"} registered today`}
        />
        <div className="p-5">
          {purposes.length === 0 ? (
            <EmptyState
              title="No visits today"
              hint="Purpose breakdown appears once visitors register today."
            />
          ) : (
            <div className="space-y-3">
              {purposes.map((purpose) => (
                <div key={purpose.name}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-medium">{purpose.name}</span>
                    <span className="shrink-0 tabular-nums text-[var(--muted)]">
                      {purpose.count} · {purpose.percent}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${purpose.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
