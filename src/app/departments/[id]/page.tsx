import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Building2, Clock, Landmark, Mail, User } from "lucide-react";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { buttonClass } from "@/components/ui";
import { SITE } from "@/lib/site-info";

type Props = { params: Promise<{ id: string }> };

async function loadDepartment(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return db.department.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      building: true,
      contactPerson: true,
      contactEmail: true,
      photoPath: true,
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const department = await loadDepartment((await params).id);
  if (!department) return { title: `Office not found · ${SITE.shortName}` };
  return {
    title: `${department.name} · ${SITE.shortName} Visitor Management`,
    description: `${department.name}${department.building ? ` at ${department.building}` : ""} — office preview and visitor registration for ${SITE.university}.`,
  };
}

export default async function DepartmentPreviewPage({ params }: Props) {
  const { id } = await params;
  const department = await loadDepartment(id);
  if (!department) notFound();

  const photo = department.photoPath
    ? `/api/department-photo?path=${encodeURIComponent(department.photoPath)}`
    : null;

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
        <Link
          href="/#departments"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          All departments &amp; offices
        </Link>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="relative h-64 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)] sm:h-80">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo}
                alt={`${department.name} building`}
                className="h-full w-full object-cover"
              />
            ) : (
              <Landmark className="absolute inset-0 m-auto h-16 w-16 text-white/30" />
            )}
            <span className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--brand)] backdrop-blur">
              <Landmark className="h-3.5 w-3.5" />
              Office preview
            </span>
          </div>

          <div className="p-6 sm:p-8">
            <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--brand)]">
              {department.name}
            </h1>
            {department.building && (
              <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
                <Building2 className="h-4 w-4" />
                {department.building}
              </p>
            )}

            <div className="mt-6 grid gap-4 border-t border-[var(--border)] pt-6 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Visiting this office?
                </p>
                <p className="mt-1 text-sm leading-relaxed">
                  Pre-register online and choose {department.name} as one of your stops. Your QR
                  pass covers every office on your itinerary.
                </p>
                <Link href="/register" className={buttonClass("primary", "mt-4")}>
                  Register to visit
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

              <dl className="space-y-2.5 rounded-xl bg-slate-50 p-4 text-sm">
                {department.contactPerson && (
                  <div className="flex items-start gap-2">
                    <User className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Contact person</dt>
                      <dd className="font-semibold">{department.contactPerson}</dd>
                    </div>
                  </div>
                )}
                {department.contactEmail && (
                  <div className="flex items-start gap-2">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                    <div>
                      <dt className="text-xs text-[var(--muted)]">Office email</dt>
                      <dd className="font-semibold break-all">{department.contactEmail}</dd>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Office hours</dt>
                    <dd className="font-semibold">
                      {SITE.officeHours[0].days}: {SITE.officeHours[0].hours}
                    </dd>
                  </div>
                </div>
              </dl>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--muted)]">
          Ask the Front Desk for directions · {SITE.contactPhone}
        </p>
      </div>
    </PublicShell>
  );
}
