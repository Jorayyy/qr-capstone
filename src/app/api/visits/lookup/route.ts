import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import { jsonError, jsonOk, rateLimitResponse, withApiHandler } from "@/lib/http";
import { qrLookupSchema } from "@/lib/validation";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Full staff projection — explicit allow-list, never raw DB rows.
 */
function staffProjection(visit: {
  id: string;
  status: string;
  purpose: string;
  qrCode: string;
  qrExpiresAt: Date | null;
  qrRevokedAt: Date | null;
  hostName: string | null;
  actualArrival: Date | null;
  actualDeparture: Date | null;
  createdAt: Date;
  visitor: {
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    idType: string;
    idNumber: string | null;
    photoUrl: string | null;
    idPhotoUrl: string | null;
  };
  referenceCode: string;
  validFrom: Date | null;
  department: { id: string; name: string; building: string | null };
  stops: Array<{
    id: string;
    checkedInAt: Date | null;
    checkedOutAt: Date | null;
    building: string | null;
    department: { name: string };
  }>;
}) {
  return {
    id: visit.id,
    referenceCode: visit.referenceCode,
    status: visit.status,
    purpose: visit.purpose,
    qrCode: visit.qrCode,
    validFrom: visit.validFrom,
    qrExpiresAt: visit.qrExpiresAt,
    hostName: visit.hostName,
    actualArrival: visit.actualArrival,
    actualDeparture: visit.actualDeparture,
    createdAt: visit.createdAt,
    visitor: {
      firstName: visit.visitor.firstName,
      lastName: visit.visitor.lastName,
      email: visit.visitor.email,
      phone: visit.visitor.phone,
      company: visit.visitor.company,
      idType: visit.visitor.idType,
      idNumber: visit.visitor.idNumber,
      photoUrl: visit.visitor.photoUrl,
      idPhotoUrl: visit.visitor.idPhotoUrl,
    },
    department: visit.department,
    stops: visit.stops,
  };
}

export async function GET(req: NextRequest) {
  return withApiHandler(req, async ({ requestId, ip }) => {
    const rawQr = req.nextUrl.searchParams.get("qr");
    const parsedQr = qrLookupSchema.safeParse(rawQr ?? "");
    if (!parsedQr.success) {
      return jsonError(400, "Missing or invalid qr parameter.", requestId);
    }
    const qr = parsedQr.data;

    const user = await getSession();
    if (!user) return jsonError(401, "Authentication required.", requestId);

    const ipLimit = await rateLimit(`lookup:ip:${ip ?? "unknown"}`, LIMITS.lookupPerIp(), WINDOWS.short);
    const qrLimit = await rateLimit(`lookup:qr:${qr}`, LIMITS.lookupPerQr(), WINDOWS.short);
    const userLimit = await rateLimit(
      `lookup:user:${user.userId}`,
      LIMITS.lookupPerUser(),
      WINDOWS.short
    );

    if (!ipLimit.ok || !qrLimit.ok || !userLimit.ok) {
      const retry =
        (!ipLimit.ok && ipLimit.retryAfterSeconds) ||
        (!qrLimit.ok && qrLimit.retryAfterSeconds) ||
        (!userLimit.ok && userLimit.retryAfterSeconds) ||
        60;
      return rateLimitResponse(retry, requestId);
    }

    const visit = await db.visit.findFirst({
      where: { OR: [{ qrCode: qr }, { referenceCode: qr.toUpperCase() }] },
      include: {
        visitor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            company: true,
            idType: true,
            idNumber: true,
            photoUrl: true,
            idPhotoUrl: true,
          },
        },
        department: { select: { id: true, name: true, building: true } },
        stops: {
          include: { department: { select: { name: true } } },
          orderBy: { checkedInAt: "asc" },
        },
      },
    });

    if (!visit) {
      await recordAudit({
        actorId: user?.userId,
        actorEmail: user?.email,
        action: "QR_LOOKUP",
        result: "FAILURE",
        targetType: "qr",
        ip,
        requestId,
        // The submitted QR value itself is intentionally not persisted.
        meta: { reason: "not_found" },
      });
      return jsonError(404, "Visit not found", requestId);
    }

    const now = Date.now();
    const expired = Boolean(visit.qrExpiresAt && visit.qrExpiresAt.getTime() < now);
    const revoked = Boolean(visit.qrRevokedAt);
    if (expired || revoked) {
      await recordAudit({
        actorId: user?.userId,
        actorEmail: user?.email,
        action: "QR_LOOKUP",
        result: "DENIED",
        targetType: "visit",
        targetId: visit.id,
        ip,
        requestId,
        meta: { reason: expired ? "expired" : "revoked" },
      });
      return jsonError(403, "This QR code is no longer valid.", requestId);
    }

    await recordAudit({
      actorId: user?.userId,
      actorEmail: user?.email,
      action: "QR_SCANNED",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visit.id,
      ip,
      requestId,
    });

    const body = staffProjection(visit);
    const res = jsonOk(body);
    for (const [key, value] of Object.entries(NO_STORE)) res.headers.set(key, value);
    return res;
  });
}
