import Link from "next/link";
import { db } from "@/lib/db";
import { Avatar, Badge, Card, CardHeader, EmptyState, Metric } from "@/components/ui";
import { manilaMidnight, manilaParts, PH_TZ } from "@/lib/ph-time";
import { Building2 } from "lucide-react";

function expectedLabel(expectedArrival: Date | null, method: string): string {
  if (!expectedArrival) return "—";
  const parts = manilaParts(expectedArrival);
  if (parts.hour === 0 && method === "PRE_REGISTERED") return "Any time";
  return expectedArrival.toLocaleTimeString("en-PH", {
    timeZone: PH_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Today's expected and on-site visitors for the signed-in staff member's office. */
export async function MyOfficeVisitors({ departmentId }: { departmentId: string | null }) {
  if (!departmentId) {
    return (
      <Card className="mb-6">
        <CardHeader title="My Office Visitors" subtitle="Today" />
        <EmptyState
          title="No office assigned"
          hint="Ask an administrator to set your office in Admin → Security → Users."
        />
      </Card>
    );
  }

  const now = manilaParts(new Date());
  const start = manilaMidnight(now.year, now.month, now.day);
  const end = manilaMidnight(now.year, now.month, now.day + 1);

  const [department, visits] = await Promise.all([
    db.department.findUnique({
      where: { id: departmentId },
      select: { name: true, building: true },
    }),
    db.visit.findMany({
      where: {
        status: { in: ["PENDING", "CHECKED_IN"] },
        AND: [
          { OR: [{ departmentId }, { stops: { some: { departmentId } } }] },
          {
            OR: [
              { expectedArrival: { gte: start, lt: end } },
              { expectedArrival: null, createdAt: { gte: start, lt: end } },
              { createdAt: { gte: start, lt: end } },
            ],
          },
        ],
      },
      orderBy: [{ expectedArrival: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        status: true,
        purpose: true,
        method: true,
        hostName: true,
        expectedArrival: true,
        createdAt: true,
        visitor: {
          select: { id: true, firstName: true, lastName: true, company: true },
        },
        stops: {
          where: { departmentId },
          select: { purpose: true, hostName: true },
        },
      },
    }),
  ]);

  const expected = visits.filter((visit) => visit.status === "PENDING").length;
  const arrived = visits.length - expected;
  const officeName = department?.name ?? "My office";
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Card className="mb-6">
      <CardHeader
        title="My Office Visitors"
        subtitle={`${officeName}${department?.building ? ` · ${department.building}` : ""} · ${todayLabel}`}
      />

      <div className="grid grid-cols-1 divide-y divide-[var(--border)] border-b border-[var(--border)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <Metric
          label="Expected today"
          value={expected}
          hint="Pending visits to your office that have not checked in yet."
        />
        <Metric
          label="On site now"
          value={arrived}
          hint="Visitors checked in for your office and not yet checked out."
        />
      </div>

      {visits.length === 0 ? (
        <EmptyState
          title="No visitors expected today"
          hint={`No pending or checked-in visits for ${officeName} today.`}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th className="px-5 py-2.5 font-semibold">Visitor</th>
                <th className="px-5 py-2.5 font-semibold">Company</th>
                <th className="px-5 py-2.5 font-semibold">Purpose</th>
                <th className="px-5 py-2.5 font-semibold">Host</th>
                <th className="px-5 py-2.5 font-semibold">Expected</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {visits.map((visit) => {
                const stop = visit.stops[0] ?? null;
                const name = `${visit.visitor.firstName} ${visit.visitor.lastName}`;
                return (
                  <tr key={visit.id}>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-3">
                        <Avatar name={name} />
                        <span className="font-medium">{name}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">{visit.visitor.company ?? "—"}</td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {(stop?.purpose ?? visit.purpose).replace("_", " ")}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {stop?.hostName ?? visit.hostName ?? "—"}
                    </td>
                    <td className="px-5 py-3 text-[var(--muted)]">
                      {expectedLabel(visit.expectedArrival, visit.method)}
                    </td>
                    <td className="px-5 py-3">
                      {visit.status === "PENDING" ? (
                        <Badge tone="amber">Expected</Badge>
                      ) : (
                        <Badge tone="green">Checked in</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="border-t border-[var(--border)] px-5 py-3 text-right">
        <Link
          href={`?dept=${departmentId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          <Building2 className="h-3.5 w-3.5" />
          View all visitors for this office
        </Link>
      </div>
    </Card>
  );
}
