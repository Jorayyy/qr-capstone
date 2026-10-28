import Link from "next/link";
import { db } from "@/lib/db";
import { requirePermission, getRequestContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import { searchQuerySchema, uuidSchema } from "@/lib/validation";
import { PageHeader, Button, Card, Badge, EmptyState, Input, Select } from "@/components/ui";
import { Plus, Search } from "lucide-react";
import { DeleteVisitorButton } from "./actions-client";

export default async function VisitorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; dept?: string }>;
}) {
  const user = await requirePermission("visitor:read");
  const mayDelete = can(user.role, "visitor:delete");
  const { q: rawQ, dept: rawDept } = await searchParams;

  const search = rawQ ? searchQuerySchema.safeParse(rawQ) : null;
  const q = search?.success && search.data ? search.data : undefined;

  const deptParsed = rawDept ? uuidSchema.safeParse(rawDept) : null;
  const departmentId = deptParsed?.success ? deptParsed.data : undefined;

  let blocked = false;
  if (q) {
    const limit = await rateLimit(`search:user:${user.userId}`, LIMITS.searchPerUser(), WINDOWS.short);
    blocked = !limit.ok;
  }

  const departments = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, building: true },
  });

  const visitors = !blocked
    ? await db.visitor.findMany({
        where: {
          ...(q
            ? {
                OR: [
                  { firstName: { contains: q, mode: "insensitive" } },
                  { lastName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
          ...(departmentId ? { visits: { some: { departmentId } } } : {}),
        },
        orderBy: { createdAt: "desc" },
        include: {
          visits: {
            select: { id: true, departmentId: true, department: { select: { name: true } } },
          },
        },
      })
    : [];

  if (blocked) {
    const ctx = await getRequestContext();
    await recordAudit({
      actorId: user.userId,
      actorEmail: user.email,
      action: "SEARCH_RATE_LIMITED",
      result: "DENIED",
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
  }

  return (
    <div>
      <PageHeader
        title="Visitors"
        subtitle="Manage registered visitors"
        actions={
          <Link href="/visitors/register">
            <Button>
              <Plus className="h-4 w-4" />
              Register Visitor
            </Button>
          </Link>
        }
      />

      <Card>
        <div className="border-b border-[var(--border)] px-5 py-3">
          <form className="flex max-w-xl flex-wrap items-center gap-3">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <Input
                name="q"
                placeholder="Search by name or email..."
                defaultValue={rawQ ? rawQ.slice(0, 100) : undefined}
                maxLength={100}
                className="pl-9"
              />
            </div>
            <Select
              name="dept"
              aria-label="Filter by office"
              defaultValue={departmentId ?? ""}
              className="max-w-56"
            >
              <option value="">All offices</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.building ? ` (${d.building})` : ""}
                </option>
              ))}
            </Select>
            <Button type="submit" variant="secondary">
              Filter
            </Button>
          </form>
        </div>

        {blocked ? (
          <EmptyState
            title="Too many searches"
            hint="Please wait a moment before searching again."
          />
        ) : visitors.length === 0 ? (
          <EmptyState
            title="No visitors found"
            hint={
              q || departmentId
                ? "Try a different search term or office."
                : "Register your first visitor to get started."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Phone</th>
                  <th className="px-5 py-3 font-semibold">Company</th>
                  <th className="px-5 py-3 font-semibold">ID Type</th>
                  <th className="px-5 py-3 font-semibold">Offices Visited</th>
                  <th className="px-5 py-3 text-center">Total Visits</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visitors.map((v) => {
                  const visits = departmentId
                    ? v.visits.filter((visit) => visit.departmentId === departmentId)
                    : v.visits;
                  const offices = [...new Set(v.visits.map((visit) => visit.department?.name).filter(Boolean))] as string[];
                  return (
                    <tr key={v.id}>
                      <td className="px-5 py-3 font-medium">
                        {v.firstName} {v.lastName}
                      </td>
                      <td className="px-5 py-3 text-[var(--muted)]">{v.email ?? "—"}</td>
                      <td className="px-5 py-3 text-[var(--muted)]">{v.phone ?? "—"}</td>
                      <td className="px-5 py-3 text-[var(--muted)]">{v.company ?? "—"}</td>
                      <td className="px-5 py-3">
                        <Badge>{v.idType.replace("_", " ")}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {offices.length === 0 ? (
                          <span className="text-[var(--muted)]">—</span>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {offices.slice(0, 2).map((name) => (
                              <Badge key={name} tone="brand">
                                {name}
                              </Badge>
                            ))}
                            {offices.length > 2 && (
                              <Badge>+{offices.length - 2}</Badge>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-center font-medium">{visits.length}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/visitors/${v.id}`}>
                            <Button variant="secondary" className="text-xs">
                              View
                            </Button>
                          </Link>
                          {mayDelete && <DeleteVisitorButton visitorId={v.id} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
