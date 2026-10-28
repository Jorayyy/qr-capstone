import { requirePermission } from "@/lib/auth";
import { PageHeader, buttonClass } from "@/components/ui";
import { Download } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { PeriodFilter } from "@/components/period-filter";
import { ReportView } from "@/components/report-view";
import { buildReport } from "@/lib/report-data";
import { isReportPeriod, type ReportPeriod } from "@/lib/reports";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  await requirePermission("report:read");

  const { period: rawPeriod } = await searchParams;
  const period: ReportPeriod = isReportPeriod(rawPeriod) ? rawPeriod : "day";
  const data = await buildReport(period);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          subtitle={data.label}
          actions={
            <div className="flex items-center gap-2">
              <PeriodFilter period={period} />
              <PrintButton />
              <a href={`/reports/export?period=${period}`} className={buttonClass("secondary")} download>
                <Download className="h-4 w-4" />
                CSV
              </a>
            </div>
          }
        />
      </div>

      {/* Print-only heading, since the interactive header is hidden when printing. */}
      <div className="mb-4 hidden print:block">
        <h1 className="text-2xl font-semibold tracking-tight">Visitor Report</h1>
        <p className="text-sm text-[var(--muted)]">
          {data.label} · generated {new Date().toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      <ReportView data={data} />
    </div>
  );
}
