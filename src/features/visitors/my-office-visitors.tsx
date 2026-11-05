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
      <Card>
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
        status: { in: ["PENDING", "CHECKED_IN", "CHECKED_OUT"] },
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

  const visitors = new Set(visits.map((visit) => visit.visitor.id)).size;
  const pending = visits.filter((visit) => visit.status === "PENDING").length;
  const arrived = visits.filter((visit) => visit.status === "CHECKED_IN").length;
  const completed = visits.filter((visit) => visit.status === "CHECKED_OUT").length;
  const officeName = department?.name ?? "My office";
  const todayLabel = new Date().toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <Card>
      <CardHeader
        title="My Office Visitors"
        subtitle={`${officeName}${department?.building ? ` · ${department.building}` : ""} · ${todayLabel}`}
      />

      <div className="flex flex-col divide-y divide-[var(--border)] border-b border-[var(--border)] sm:flex-row sm:divide-x sm:divide-y-0">
        <Metric
          label="Visitors"
          value={visitors}
          hint="Visitors scheduled for your office today."
        />
        <Metric
          label="Pending Visit"
          value={pending}
          hint="Registered but not yet checked in."
        />
        <Metric
          label="Arrived Office"
          value={arrived}
          hint="Checked in and not yet checked out."
        />
        <Metric
          label="Complete Visit"
          value={completed}
          hint="Checked out today."
        />
      </div>

      {visits.length === 0 ? (
        <EmptyState
          title="No visitors today"
          hint={`No visits for ${officeName} today.`}
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
                        <Badge tone="amber">Pending Visit</Badge>
                      ) : visit.status === "CHECKED_IN" ? (
                        <Badge tone="green">Arrived Office</Badge>
                      ) : (
                        <Badge tone="gray">Complete Visit</Badge>
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
          href={`/staff/visitors?dept=${departmentId}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          <Building2 className="h-3.5 w-3.5" />
          View all visitors for this office
        </Link>
      </div>
    </Card>
  );
}
