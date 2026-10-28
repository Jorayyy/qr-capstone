import { notFound } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { PH_TZ } from "@/lib/ph-time";
import { getRequestContext, requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { Card, CardHeader, Badge, EmptyState, PageHeader, Avatar, buttonClass } from "@/components/ui";
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
} from "lucide-react";

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

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start) return "—";
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffMs = endTime - new Date(start).getTime();
  if (diffMs < 0) return "—";
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
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
                color: { dark: "#1e293b", light: "#ffffff" },
              }),
              inactive: invalidationLabel(v),
            },
          ] as const
      )
    )
  );

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
        <Link href="/visitors" className="text-sm text-[var(--muted)] hover:text-[var(--brand)]">
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
              className="h-16 w-16 shrink-0 rounded-2xl border border-[var(--border)] bg-slate-50 object-cover shadow-sm"
            />
          ) : (
            <Avatar
              name={`${visitor.firstName} ${visitor.lastName}`}
              className="h-16 w-16 rounded-2xl text-lg"
            />
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Visitor Info" />
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-[var(--muted)]" />
              <span>{visitor.email ?? "No email"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-[var(--muted)]" />
              <span>{visitor.phone ?? "No phone"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Building2 className="h-4 w-4 text-[var(--muted)]" />
              <span>{visitor.company ?? "No company"}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <CreditCard className="h-4 w-4 text-[var(--muted)]" />
              <span>{visitor.idType.replace("_", " ")}{visitor.idNumber ? ` — ${visitor.idNumber}` : ""}</span>
            </div>

            {(visitor.photoUrl || visitor.idPhotoUrl) && (
              <div className="grid grid-cols-2 gap-3 border-t border-[var(--border)] pt-4">
                {visitor.photoUrl && (
                  <div>
                    <p className="mb-1 text-xs text-[var(--muted)]">Visitor Photo</p>
                    <a
                      href={`/api/visitor-photo?path=${encodeURIComponent(visitor.photoUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/visitor-photo?path=${encodeURIComponent(visitor.photoUrl)}`}
                        alt="Visitor photo"
                        className="h-40 w-full rounded-lg border border-[var(--border)] bg-slate-50 object-cover"
                      />
                    </a>
                  </div>
                )}
                {visitor.idPhotoUrl && (
                  <div>
                    <p className="mb-1 text-xs text-[var(--muted)]">ID Photo</p>
                    <a
                      href={`/api/visitor-photo?path=${encodeURIComponent(visitor.idPhotoUrl)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img
                        src={`/api/visitor-photo?path=${encodeURIComponent(visitor.idPhotoUrl)}`}
                        alt="ID photo"
                        className="h-40 w-full rounded-lg border border-[var(--border)] bg-slate-50 object-contain"
                      />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Visit History" subtitle={`${visitor.visits.length} visit(s)`} />
          {visitor.visits.length === 0 ? (
            <EmptyState title="No visits yet" hint="This visitor has no recorded visits." />
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {visitor.visits.map((v) => {
                const qr = qrImages.get(v.id);
                return (
                <div key={v.id} className="p-5">
                  {/* Header row: date, dept, purpose, status */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span className="font-medium">{formatDate(v.createdAt)}</span>
                    <span className="font-mono text-xs font-semibold text-[var(--brand)]">{v.referenceCode}</span>
                    <span className="text-[var(--muted)]">{v.department.name}</span>
                    <span className="text-[var(--muted)]">{v.purpose.replace("_", " ")}</span>
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
                        className={`h-20 w-20 rounded-lg border border-[var(--border)] bg-white p-1 ${
                          qr?.inactive ? "opacity-40" : ""
                        }`}
                      />
                      {qr?.inactive && (
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60 text-[10px] font-bold uppercase tracking-wide text-slate-600">
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
                    <div className="mt-3 rounded-lg bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        Building Stops ({v.stops.length})
                      </p>
                      <div className="space-y-1.5">
                        {v.stops.map((stop, i) => (
                          <div key={stop.id} className="flex items-center gap-3 text-xs">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white">
                              {i + 1}
                            </span>
                            <MapPin className="h-3 w-3 text-slate-400" />
                            <span className="font-medium">{stop.department.name}</span>
                            {stop.building && <span className="text-[var(--muted)]">({stop.building})</span>}
                            <span className="text-[var(--muted)]">{formatDate(stop.checkedInAt)}</span>
                            {!stop.checkedInAt ? (
                              <Badge tone="gray">Not yet visited</Badge>
                            ) : stop.checkedOutAt ? (
                              <span className="text-emerald-600">
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
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
