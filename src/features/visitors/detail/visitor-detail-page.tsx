import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { PH_TZ } from "@/lib/ph-time";
import { getRequestContext, requirePermission } from "@/lib/auth";
import { currentPortal } from "@/lib/portal-server";
import { portalHref } from "@/lib/portal";
import { recordAudit } from "@/lib/audit";
import { Card, CardHeader, Badge, EmptyState, PageHeader, Avatar, buttonClass, cx } from "@/components/ui";
import { VisitControls } from "../actions-client";
import {
  Mail,
  Phone,
  Building2,
  CreditCard,
  MapPin,
  User,
  Car,
  QrCode,
  Clock,
  Download,
  CalendarDays,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { VisitHistory } from "./visit-history";

function formatDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-PH", {
    timeZone: PH_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-PH", {
    timeZone: PH_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSpan(diffMs: number): string {
  if (diffMs < 0) return "—";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "—";
  const endTime = end ? new Date(end).getTime() : Date.now();
  return formatSpan(endTime - new Date(start).getTime());
}

/** One labelled metadata row in the profile card. */
function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-5 py-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">{label}</p>
        <div className="mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}


const STATUS_BADGE: Record<string, { tone: "brand" | "green" | "red" | "gray" }> = {
  PENDING: { tone: "brand" },
  CHECKED_IN: { tone: "green" },
  CHECKED_OUT: { tone: "gray" },
  CANCELLED: { tone: "red" },
};

/** Label for why a pass is no longer valid, or null while it is still usable. */
function invalidationLabel(v: {
  status: string;
  qrExpiresAt: Date | null;
  qrRevokedAt: Date | null;
}): string | null {
  if (v.qrRevokedAt) return "Revoked";
  if (v.status === "CANCELLED") return "Cancelled";
  if (v.status === "CHECKED_OUT") return "Used";
  if (v.qrExpiresAt && v.qrExpiresAt.getTime() < Date.now()) return "Expired";
  return null;
}

export default async function VisitorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePermission("visitor:read");
  const portal = await currentPortal();

  const visitor = await db.visitor.findUnique({
    where: { id },
    include: {
      visits: {
        orderBy: { createdAt: "desc" },
        include: {
          department: true,
          stops: { include: { department: true }, orderBy: { checkedInAt: "asc" } },
        },
      },
    },
  });

  if (!visitor) notFound();

  const activeVisit =
    visitor.visits.find((v) => v.status === "CHECKED_IN") ??
    visitor.visits.find((v) => v.status === "PENDING") ??
    null;
  const activeStop = activeVisit?.stops.find((stop) => stop.checkedInAt && !stop.checkedOutAt) ?? null;

  const qrImages = new Map(
    await Promise.all(
      visitor.visits.map(
        async (v) =>
          [
            v.id,
            {
              image: await QRCode.toDataURL(v.qrCode, {
                width: 200,
                margin: 1,
                color: { dark: "#6f1010", light: "#ffffff" },
              }),
              inactive: invalidationLabel(v),
            },
          ] as const
      )
    )
  );

  const completedVisits = visitor.visits.filter((v) => v.actualArrival && v.actualDeparture);
  const durations = completedVisits.map(
    (v) => v.actualDeparture!.getTime() - v.actualArrival!.getTime()
  );
  const avgMs = durations.length ? durations.reduce((sum, d) => sum + d, 0) / durations.length : null;
  const officesVisited = new Set(visitor.visits.map((v) => v.department.name)).size;
  const lastVisitAt = visitor.visits[0]?.createdAt ?? null;
  const affiliation =
    visitor.affiliation === "OTHER" && visitor.affiliationOther
      ? visitor.affiliationOther
      : visitor.affiliation.replace("_", " ");

  const summary = [
    { label: "Total visits", value: visitor.visits.length },
    { label: "Completed", value: completedVisits.length },
    { label: "Offices visited", value: officesVisited },
    { label: "Avg visit", value: avgMs === null ? "—" : formatSpan(avgMs) },
  ];

  const photos = [
    visitor.photoUrl && { label: "Visitor Photo", path: visitor.photoUrl, fit: "object-cover" },
    visitor.idPhotoUrl && { label: "ID Photo", path: visitor.idPhotoUrl, fit: "object-contain" },
  ].filter(Boolean) as Array<{ label: string; path: string; fit: string }>;

  // Audit access to a visitor's personal record (PII).
  const ctx = await getRequestContext();
  await recordAudit({
    actorId: user.userId,
    actorEmail: user.email,
    action: "VISITOR_VIEWED",
    result: "SUCCESS",
    targetType: "visitor",
    targetId: visitor.id,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
    requestId: ctx.requestId,
  });

  return (
    <div>
      <div className="mb-4">
        <Link href={portalHref(portal, "/visitors")} className="text-sm text-[var(--muted)] hover:text-[var(--brand)]">
          ← Back to Visitors
        </Link>
      </div>

      <PageHeader
        title={`${visitor.firstName} ${visitor.lastName}`}
        subtitle="Visitor profile and visit history"
        leading={
          visitor.photoUrl ? (
            <img
              src={`/api/visitor-photo?path=${encodeURIComponent(visitor.photoUrl)}`}
              alt=""
              className="h-16 w-16 shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] object-cover"
            />
          ) : (
            <Avatar
              name={`${visitor.firstName} ${visitor.lastName}`}
              className="h-16 w-16 rounded-lg text-lg"
            />
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:order-2 lg:col-span-2">
          <Card>
            <CardHeader title="Current transaction" subtitle="Live visit status and location" />
            {!activeVisit ? (
              <div className="flex items-center gap-3 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--brand)]">
                  <Inbox className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">No active visit</p>
                  <p className="text-xs text-[var(--muted)]">
                    Not expected or checked in right now. Past visits are listed below.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 p-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="text-xs text-[var(--muted)]">Status</p>
                  <p className="mt-1">
                    <Badge tone={STATUS_BADGE[activeVisit.status]?.tone}>
                      {activeVisit.status.replace("_", " ")}
                    </Badge>
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Reference</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-[var(--brand)]">
                    {activeVisit.referenceCode}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    {activeVisit.status === "CHECKED_IN" ? "Current office" : "Expected office"}
                  </p>
                  <p className="mt-1 font-medium">
                    {activeStop?.department.name ?? activeVisit.department.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">
                    {activeVisit.status === "CHECKED_IN" ? "Inside for" : "Checked in"}
                  </p>
                  <p className="mt-1 font-medium">
                    {activeVisit.status === "CHECKED_IN"
                      ? formatDuration(activeStop?.checkedInAt ?? activeVisit.actualArrival, null)
                      : formatDate(activeVisit.actualArrival)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Host</p>
                  <p className="mt-1 font-medium">{activeStop?.hostName ?? activeVisit.hostName ?? "Any"}</p>
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">Purpose</p>
                  <p className="mt-1 font-medium">
                    {activeVisit.purpose === "OTHER" && activeVisit.purposeOther
                      ? activeVisit.purposeOther
                      : activeVisit.purpose.replace("_", " ")}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-[var(--muted)]">Next step</p>
                  <p className="mt-1 font-medium">
                    {activeVisit.status === "PENDING"
                      ? "Waiting for check-in at the office scanner."
                      : "Check-out is recorded by scanning this pass at the scanner."}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <Card>
          {visitor.visits.length === 0 ? (
            <>
              <CardHeader title="Visit History" subtitle="0 visit(s)" />
              <EmptyState title="No visits yet" hint="This visitor has no recorded visits." />
            </>
          ) : (
              <VisitHistory
                items={visitor.visits.map((v) => {
                const qr = qrImages.get(v.id);
                return {
                id: v.id,
                label: `${formatDate(v.createdAt)} — ${v.referenceCode}`,
                content: (
                <div key={v.id} className="p-5">
                  {/* Header row: date, dept, purpose, status */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-medium">{formatDate(v.createdAt)}</span>
                    <span className="font-mono text-xs font-semibold text-[var(--brand)]">{v.referenceCode}</span>
                    <span className="text-[var(--muted)]">{v.department.name}</span>
                    <span className="text-[var(--muted)]">{v.purpose === "OTHER" && v.purposeOther ? v.purposeOther : v.purpose.replace("_", " ")}</span>
                    <Badge tone={STATUS_BADGE[v.status]?.tone}>{v.status.replace("_", " ")}</Badge>
                  </div>

                  <div className="mt-1 text-xs text-[var(--muted)]">
                    Pass valid {formatDate(v.validFrom)} — {formatDate(v.qrExpiresAt)}
                    {v.consentedAt && (
                      <span className="ml-2">
                        · Privacy consent v{v.consentVersion ?? "1.0"} on {formatDate(v.consentedAt)}
                      </span>
                    )}
                  </div>

                  {/* Check-in/out + duration */}
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      In: {formatDate(v.actualArrival)}
                    </span>
                    <span>Out: {formatDate(v.actualDeparture)}</span>
                    {v.actualArrival && (
                      <span className="font-medium text-[var(--foreground)]">
                        Duration: {formatDuration(v.actualArrival, v.actualDeparture)}
                      </span>
                    )}
                  </div>

                  {/* Host + Vehicle info */}
                  {(v.hostName || v.hostDepartment || v.vehicleType || v.vehicleModel || v.vehiclePlateNumber) && (
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                      {v.hostName && (
                        <span className="flex items-center gap-1 text-[var(--muted)]">
                          <User className="h-3 w-3" />
                          Host: {v.hostName}
                          {v.hostDepartment && ` (${v.hostDepartment})`}
                        </span>
                      )}
                      {(v.vehicleType || v.vehicleModel || v.vehicleColor || v.vehiclePlateNumber) && (
                        <span className="flex items-center gap-1 text-[var(--muted)]">
                          <Car className="h-3 w-3" />
                          Vehicle: {[v.vehicleType, v.vehicleModel, v.vehicleColor, v.vehiclePlateNumber].filter(Boolean).join(" — ")}
                        </span>
                      )}
                    </div>
                  )}

                  {/* QR code reference */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={qr?.image}
                        alt={`QR code ${v.qrCode}`}
                        className={`h-20 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 ${
                          qr?.inactive ? "opacity-40" : ""
                        }`}
                      />
                      {qr?.inactive && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-[var(--surface)]/60 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {qr.inactive}
                        </span>
                      )}
                    </div>
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <div className="flex items-center gap-1 text-xs text-[var(--muted)]">
                        <QrCode className="h-3 w-3 shrink-0" />
                        <span className="font-mono break-all">{v.qrCode}</span>
                      </div>
                      {!qr?.inactive && (
                        <a
                          href={qr?.image}
                          download={`QR-${visitor.firstName}-${visitor.lastName}-${v.qrCode}.png`}
                          className={buttonClass("secondary", "min-h-0 w-fit px-2.5 py-1 text-xs")}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download QR
                        </a>
                      )}
                      <a
                        href={`/pass/${v.qrCode}`}
                        target="_blank"
                        rel="noreferrer"
                        className={buttonClass("secondary", "min-h-0 w-fit px-2.5 py-1 text-xs")}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                        Open pass
                      </a>
                    </div>
                  </div>

                  {/* Admin-controlled entry/exit (works without scanning) */}
                  <VisitControls visitId={v.id} status={v.status} />

                  {/* Building stops */}
                  {v.stops.length > 0 && (
                    <div className="mt-3 rounded-lg bg-[var(--surface-muted)] p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                        Building Stops ({v.stops.length})
                      </p>
                      <div className="space-y-1.5">
                        {v.stops.map((stop, i) => (
                          <div key={stop.id} className="flex items-center gap-3 text-xs">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-[10px] font-semibold text-white">
                              {i + 1}
                            </span>
                            <MapPin className="h-3 w-3 text-[var(--muted)]" />
                            <span className="font-medium">{stop.department.name}</span>
                            {stop.building && <span className="text-[var(--muted)]">({stop.building})</span>}
                            <span className="text-[var(--muted)]">{formatDate(stop.checkedInAt)}</span>
                            {!stop.checkedInAt ? (
                              <Badge tone="gray">Not yet visited</Badge>
                            ) : stop.checkedOutAt ? (
                              <span className="text-[var(--success)]">
                                → {formatDate(stop.checkedOutAt)}
                                <span className="ml-1 text-[var(--muted)]">
                                  ({formatDuration(stop.checkedInAt, stop.checkedOutAt)})
                                </span>
                              </span>
                            ) : (
                              <Badge tone="green">Currently here</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                ),
                };
                })}
              />
          )}
          </Card>
        </div>

        <div className="space-y-6 lg:order-1">
          <Card>
            <CardHeader title="Visitor Info" subtitle={affiliation} />
            <div className="divide-y divide-[var(--border)]">
              <InfoRow icon={Mail} label="Email" value={visitor.email ?? "No email"} />
              <InfoRow icon={Phone} label="Phone" value={visitor.phone ?? "No phone"} />
              <InfoRow icon={Building2} label="Company" value={visitor.company ?? "No company"} />
              <InfoRow
                icon={CreditCard}
                label="ID"
                value={`${visitor.idType === "OTHER" && visitor.idTypeOther ? visitor.idTypeOther : visitor.idType.replace("_", " ")}${
                  visitor.idNumber ? ` — ${visitor.idNumber}` : ""
                }`}
              />
              {visitor.dateOfBirth && (
                <InfoRow icon={CalendarDays} label="Date of birth" value={formatDay(visitor.dateOfBirth)} />
              )}
              <InfoRow
                icon={Clock}
                label="Last visit"
                value={lastVisitAt ? formatDate(lastVisitAt) : "No visits yet"}
              />
              <InfoRow icon={CalendarDays} label="Member since" value={formatDay(visitor.createdAt)} />
            </div>
            {photos.length > 0 && (
              <div className={cx("grid gap-3 border-t border-[var(--border)] p-5", photos.length > 1 && "grid-cols-2")}>
                {photos.map((photo) => (
                  <div key={photo.label}>
                    <p className="mb-1 text-xs text-[var(--muted)]">{photo.label}</p>
                    <a
                      href={`/api/visitor-photo?path=${encodeURIComponent(photo.path)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/visitor-photo?path=${encodeURIComponent(photo.path)}`}
                        alt={photo.label}
                        className={cx(
                          "h-40 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]",
                          photo.fit
                        )}
                      />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Visit summary" subtitle="Lifetime activity" />
            <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
              {summary.map((stat) => (
                <div key={stat.label} className="bg-[var(--surface)] p-4">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">
                    {stat.label}
                  </p>
                  <p className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-[var(--foreground)]">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
