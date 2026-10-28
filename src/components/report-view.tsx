import { Card, CardHeader, EmptyState, Metric } from "@/components/ui";
import type { BreakdownRow, ReportData, TrendPoint } from "@/lib/report-data";

function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  const labelEvery = points.length <= 12 ? 1 : Math.ceil(points.length / 12);
  return (
    <div>
      <div className="flex h-40 items-end gap-1">
        {points.map((p) => {
          const height = p.count ? `${Math.max(Math.round((p.count / max) * 100), 4)}%` : "2px";
          return (
            <div key={p.label} className="group flex h-full flex-1 items-end">
              <div
                style={{ height }}
                title={`${p.label} — ${p.count} registration${p.count === 1 ? "" : "s"}`}
                className={
                  p.count
                    ? "relative w-full rounded-t-sm bg-[var(--brand)]/80 transition-colors group-hover:bg-[var(--brand)]"
                    : "w-full rounded-t-sm bg-[var(--border)]"
                }
              >
                {p.count > 0 && (
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded-md bg-[var(--foreground)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white group-hover:block">
                    {p.count}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1 text-[10px] tabular-nums text-[var(--muted)]">
        {points.map((p, i) => (
          <div key={p.label} className="flex-1 text-center">
            {i % labelEvery === 0 ? p.label : ""}
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownColumn({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  return (
    <div>
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No data</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => (
            <div key={r.name}>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-medium">{r.name}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">
                  {r.count} · {r.percent}%
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                <div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${r.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="tabular-nums font-semibold text-[var(--foreground)]">{children}</span>
      {label}
    </span>
  );
}

export function ReportView({ data }: { data: ReportData }) {
  const { metrics, trend, kpis } = data;
  const newVisitors = Math.max(0, kpis.unique - kpis.returning);

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col divide-y divide-[var(--border)] sm:flex-row sm:divide-x sm:divide-y-0">
          {metrics.map((m) => (
            <Metric key={m.label} label={m.label} value={m.value} hint={m.hint} delta={m.delta} />
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-1 text-xs text-[var(--muted)]">
        <Kpi label="inside now">{kpis.inside}</Kpi>
        <Kpi label="avg duration">{kpis.avgDuration}</Kpi>
        <Kpi label="peak">{kpis.peakLabel ?? "—"}</Kpi>
        <Kpi label={`unique (${newVisitors} new · ${kpis.returning} returning)`}>{kpis.unique}</Kpi>
      </div>

      <Card>
        <CardHeader title="Visits over time" subtitle={trend.caption} />
        <div className="p-5">
          {metrics[0].value === 0 ? (
            <EmptyState title="No data" hint="The chart fills in once visits are registered." />
          ) : (
            <TrendChart points={trend.points} />
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Breakdown" subtitle="Share of registrations" />
        <div className="grid grid-cols-1 gap-6 p-5 sm:grid-cols-3">
          <BreakdownColumn title="By department" rows={data.byDepartment} />
          <BreakdownColumn title="By purpose" rows={data.byPurpose} />
          <BreakdownColumn title="By status" rows={data.byStatus} />
        </div>
      </Card>
    </div>
  );
}
