import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { ArrowLeft, LogIn, ShieldAlert, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { PublicShell } from "@/components/public-shell";
import { SITE } from "@/lib/site-info";
import { passState } from "@/lib/registration";
import PassActions from "./pass-actions";

const PASS_CODE = /^VMS-[A-F0-9]{32}$/;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `Visitor pass · ${SITE.shortName}`,
  robots: { index: false, follow: false },
};

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

export default async function PassPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!PASS_CODE.test(code)) notFound();

  const visit = await db.visit.findUnique({
    where: { qrCode: code },
    include: {
      visitor: true,
      department: { select: { name: true } },
      stops: {
        include: { department: { select: { name: true } } },
        orderBy: { department: { name: "asc" } },
      },
    },
  });

  if (!visit) notFound();

  const state = passState(visit);
  const active = state === "ACTIVE" || state === "INSIDE";
  const officeNames = visit.stops.length
    ? visit.stops.map((stop) => stop.department.name)
    : [visit.department.name];

  const qrDataUrl = await QRCode.toDataURL(code, {
    width: 480,
    margin: 1,
    color: { dark: "#700000", light: "#ffffff" },
  });

  const statusLabel =
    state === "REVOKED"
      ? "Revoked"
      : state === "CANCELLED"
        ? "Cancelled"
        : state === "EXPIRED"
          ? "Expired"
          : state === "INSIDE"
            ? "Currently inside"
            : "Active";

  const initials = `${visit.visitor.firstName[0] ?? ""}${visit.visitor.lastName[0] ?? ""}`.toUpperCase();

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="no-print mb-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to homepage
        </Link>

        <article className="pass-card overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-lg">
          <header className="bg-[var(--brand)] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="" className="h-12 w-12 shrink-0 object-contain" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">
                  {SITE.university}
                </p>
                <p className="font-display text-xl font-bold tracking-tight">Visitor Pass</p>
              </div>
            </div>
          </header>

          <div className="px-6 py-6">
            <div className="flex items-center gap-4">
              {visit.visitor.photoUrl ? (
                <img
                  src={`/api/pass-photo?code=${code}`}
                  alt={`Photo of ${visit.visitor.firstName} ${visit.visitor.lastName}`}
                  className="h-20 w-20 shrink-0 rounded-xl border border-[var(--border)] object-cover"
                />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] font-display text-2xl font-bold text-[var(--brand)]">
                  {initials || "?"}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {visit.visitor.affiliation.toLowerCase().replace("_", " ")}
                </p>
                <h1 className="mt-0.5 truncate font-display text-lg font-bold leading-tight">
                  {visit.visitor.firstName} {visit.visitor.middleName ? `${visit.visitor.middleName} ` : ""}
                  {visit.visitor.lastName}
                </h1>
                <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
                  {visit.referenceCode}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-center rounded-xl border border-[var(--border)] bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR pass ${visit.referenceCode}`} width={208} height={208} />
            </div>

            <p className="mt-2 text-center font-mono text-[11px] text-[var(--muted)]">{code}</p>

            <dl className="mt-5 divide-y divide-[var(--border)] border-y border-[var(--border)] text-sm">
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[var(--muted)]">Valid from</dt>
                <dd className="font-semibold">{formatDate(visit.validFrom)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[var(--muted)]">Valid until</dt>
                <dd className="font-semibold">{formatDate(visit.qrExpiresAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[var(--muted)]">Visit type</dt>
                <dd className="font-semibold">{visit.visitType === "MULTIPLE" ? "Multiple visits" : "One-day visit"}</dd>
              </div>
              <div className="flex items-start justify-between gap-4 py-2.5">
                <dt className="text-[var(--muted)]">Offices</dt>
                <dd className="text-right font-semibold">{officeNames.join(", ")}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[var(--muted)]">Status</dt>
                <dd>
                  <span
                    className={
                      active
                        ? "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 ring-1 ring-emerald-200"
                        : "inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700 ring-1 ring-red-200"
                    }
                  >
                    {active ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                    {statusLabel}
                  </span>
                </dd>
              </div>
            </dl>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-[var(--muted)]">
              Present this pass and the same physical ID at the gate. The pass is non-transferable.
            </p>
          </div>
        </article>

        <PassActions qrDataUrl={qrDataUrl} reference={visit.referenceCode} />

        <div className="no-print mt-4 text-center">
          <Link
            href="/checkin"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
          >
            <LogIn className="h-4 w-4" />
            Self check-in / check-out
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
