import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Badge, Button, PageHeader, EmptyState, iconActionClass } from "@/components/ui";
import { Plus, Pencil, Landmark } from "lucide-react";
import { requirePermission } from "@/lib/auth";
import { ToggleForm, DeleteForm } from "./actions-client";
import { departmentPhotoSrc } from "@/lib/photos";

export default async function DepartmentsPage() {
  await requirePermission("department:manage");

  const departments = await db.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { visits: true, visitStops: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Departments"
        subtitle="Manage university departments"
        actions={
          <Link href="/departments/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add Department
            </Button>
          </Link>
        }
      />

      {departments.length === 0 ? (
        <Card>
          <EmptyState title="No departments" hint="Add a department to get started." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {departments.map((d) => (
            <Card
              key={d.id}
              className="group relative flex flex-col overflow-hidden transition-colors hover:border-[var(--brand)]/30"
            >
              <div className="relative h-28 overflow-hidden bg-[var(--brand-soft)]">
                {d.photoPath ? (
                  <img
                    src={departmentPhotoSrc(d.photoPath) ?? undefined}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Landmark strokeWidth={1.5} className="h-8 w-8 text-[var(--brand)]/35" />
                  </div>
                )}
                <div className="absolute right-3 top-3">
                  <Badge tone={d.isActive ? "green" : "gray"}>
                    {d.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between gap-4 p-4">
                <div>
                  <h3 className="truncate text-sm font-semibold">{d.name}</h3>
                  {d.building && (
                    <p className="mt-0.5 truncate text-xs text-[var(--muted)]">{d.building}</p>
                  )}

                  {(d.contactPerson || d.contactEmail) && (
                    <div className="mt-3 space-y-1 text-xs text-[var(--muted)]">
                      {d.contactPerson && <p className="truncate">Contact: {d.contactPerson}</p>}
                      {d.contactEmail && <p className="truncate">Email: {d.contactEmail}</p>}
                    </div>
                  )}
                </div>

                <div className="flex gap-5">
                  <div>
                    <p className="text-xl font-semibold leading-none tabular-nums text-[var(--foreground)]">{d._count.visits}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">visit(s)</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold leading-none tabular-nums text-[var(--foreground)]">{d._count.visitStops}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">stop(s)</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 transition-opacity duration-200 focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                <Link
                  href={`/departments/${d.id}/edit`}
                  className={iconActionClass("brand")}
                  title="Edit department"
                  aria-label="Edit department"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <ToggleForm departmentId={d.id} isActive={d.isActive} />
                <DeleteForm departmentId={d.id} visitCount={d._count.visits} stopCount={d._count.visitStops} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
