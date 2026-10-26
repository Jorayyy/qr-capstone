"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSession, getRequestContext, type SessionUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { emailEnabled, sendQrEmail } from "@/lib/email";
import { can, type Permission } from "@/lib/rbac";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import { isUniqueViolation, nextReferenceCode } from "@/lib/reference";
import { formString, registerVisitorSchema, uuidSchema } from "@/lib/validation";

export type ActionState = {
  success: boolean;
  message: string;
  data?: {
    visitorId: string;
    visitId: string;
    qrCode: string;
    emailSent?: boolean;
    emailTo?: string;
  };
};

export type VisitActionState = {
  success: boolean;
  message: string;
};

const DENIED: VisitActionState = {
  success: false,
  message: "You are not authorized to perform this action.",
};

/**
 * Server-side authorization gate for mutations: authenticated, permitted,
 * and audited on denial. Client-side checks are convenience only.
 */
async function guard(
  permission: Permission,
  action: string,
  targetId?: string
): Promise<{ user: SessionUser; ctx: Awaited<ReturnType<typeof getRequestContext>> } | null> {
  const ctx = await getRequestContext();
  const user = await getSession();
  if (!user || !can(user.role, permission)) {
    await recordAudit({
      actorId: user?.userId,
      actorEmail: user?.email,
      action,
      result: "DENIED",
      targetType: "action",
      targetId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { permission, role: user?.role ?? "anonymous" },
    });
    return null;
  }
  return { user, ctx };
}

/**
 * Cryptographically secure QR credential: 128 bits of entropy, no timestamp
 * (previous format leaked creation time and had only 32 bits of entropy).
 */
function generateQrCode(): string {
  return `VMS-${randomBytes(16).toString("hex").toUpperCase()}`;
}

function qrExpiryDate(expectedArrival?: Date | null): Date {
  const base = expectedArrival && expectedArrival.getTime() > Date.now() ? expectedArrival : new Date();
  return new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000);
}

type VisitRow = {
  id: string;
  status: "PENDING" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";
  qrRevokedAt: Date | null;
};

/**
 * Single place where visit status changes happen. Illegal transitions
 * (resurrecting cancelled/completed visits, double check-in, …) are refused.
 */
async function transitionVisit(
  visit: VisitRow,
  to: "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED"
): Promise<{ ok: true; at: Date } | { ok: false; message: string }> {
  const now = new Date();
  const allowed =
    (visit.status === "PENDING" && (to === "CHECKED_IN" || to === "CANCELLED")) ||
    (visit.status === "CHECKED_IN" && (to === "CHECKED_OUT" || to === "CANCELLED"));

  if (!allowed) {
    return {
      ok: false,
      message: `Visit is already ${visit.status.toLowerCase().replace("_", " ")}.`,
    };
  }
  if (to === "CHECKED_IN" && visit.qrRevokedAt) {
    return { ok: false, message: "This QR code has been revoked." };
  }
  return { ok: true, at: now };
}

function formDataToInput(formData: FormData) {
  const keys = [
    "firstName",
    "lastName",
    "email",
    "phone",
    "company",
    "idType",
    "idNumber",
    "photoUrl",
    "idPhotoUrl",
    "departmentId",
    "purpose",
    "hostName",
    "hostDepartment",
    "vehicleType",
    "vehicleModel",
    "vehiclePlateNumber",
    "notes",
  ] as const;
  const raw: Record<string, string> = {};
  for (const key of keys) raw[key] = formString(formData, key);
  return registerVisitorSchema.safeParse(raw);
}

/**
 * Registers a visitor and issues their QR credential.
 * Staff-only: the kiosk/public registration path was removed, so this now
 * requires an authenticated user with visitor:write.
 */
export async function registerVisitorAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const auth = await guard("visitor:write", "VISITOR_REGISTERED");
  if (!auth) return { success: false, message: DENIED.message };
  const { user, ctx } = auth;

  const ipLimit = await rateLimit(
    `register:ip:${ctx.ip ?? "unknown"}`,
    LIMITS.registerPerIp(),
    WINDOWS.hour
  );
  const globalLimit = await rateLimit("register:global", LIMITS.registerGlobal(), WINDOWS.hour);
  const userLimit = await rateLimit(
    `register:user:${user.userId}`,
    LIMITS.registerPerUser(),
    WINDOWS.hour
  );

  if (!ipLimit.ok || !globalLimit.ok || !userLimit.ok) {
    return {
      success: false,
      message: "Too many registrations from this device. Please try again later.",
    };
  }

  const parsed = formDataToInput(formData);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Please check the form fields and try again.",
    };
  }
  const input = parsed.data;

  try {
    const department = await db.department.findUnique({
      where: { id: input.departmentId },
      select: { id: true, name: true, building: true, isActive: true },
    });
    if (!department || !department.isActive) {
      return { success: false, message: "The selected department is unavailable." };
    }

    const qrCode = generateQrCode();

    let visitor;
    const existing = input.email
      ? await db.visitor.findFirst({ where: { email: input.email } })
      : null;

    if (existing) {
      visitor = await db.visitor.update({
        where: { id: existing.id },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          company: input.company,
          idType: input.idType,
          idNumber: input.idNumber,
          ...(input.photoUrl ? { photoUrl: input.photoUrl } : {}),
          ...(input.idPhotoUrl ? { idPhotoUrl: input.idPhotoUrl } : {}),
        },
      });
    } else {
      visitor = await db.visitor.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          company: input.company,
          idType: input.idType,
          idNumber: input.idNumber,
          photoUrl: input.photoUrl,
          idPhotoUrl: input.idPhotoUrl,
        },
      });
    }

    const validatedAt = new Date();
    let visit: { id: string; referenceCode: string; validFrom: Date | null; qrExpiresAt: Date | null } | null = null;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const referenceCode = await nextReferenceCode();
      try {
        visit = await db.$transaction(async (tx) => {
          const created = await tx.visit.create({
            data: {
              referenceCode,
              visitorId: visitor.id,
              departmentId: input.departmentId,
              purpose: input.purpose,
              status: "PENDING",
              method: "WALK_IN",
              visitType: "ONE_DAY",
              expectedArrival: validatedAt,
              validFrom: validatedAt,
              qrCode,
              qrExpiresAt: qrExpiryDate(null),
              hostName: input.hostName,
              hostDepartment: input.hostDepartment,
              vehicleType: input.vehicleType,
              vehicleModel: input.vehicleModel,
              vehiclePlateNumber: input.vehiclePlateNumber,
              notes: input.notes,
            },
          });
          await tx.visitStop.create({
            data: {
              visitId: created.id,
              departmentId: input.departmentId,
              building: department.building,
              purpose: input.purpose,
              hostName: input.hostName,
            },
          });
          return created;
        });
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === 4) throw error;
      }
    }

    if (!visit) {
      return { success: false, message: "Could not allocate a reference number. Please retry." };
    }

    await recordAudit({
      actorId: user?.userId,
      actorEmail: user?.email,
      action: "VISITOR_REGISTERED",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visit.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: {
        channel: user.role === "SECURITY" ? "guard" : "staff",
        actorRole: user.role,
        visitorId: visitor.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/visitors");

    let emailSent = false;
    const emailTo = input.email && emailEnabled() ? input.email : undefined;
    if (emailTo) {
      emailSent = await sendQrEmail({
        to: emailTo,
        visitorName: `${visitor.firstName} ${visitor.lastName}`,
        qrCode,
        referenceCode: visit.referenceCode,
        visitType: "ONE_DAY",
        offices: [department.name],
        departmentName: department.name,
        purpose: input.purpose,
        validFrom: visit.validFrom,
        expiresAt: visit.qrExpiresAt,
        passUrl: `/pass/${qrCode}`,
      });
      await recordAudit({
        actorId: user?.userId,
        actorEmail: user?.email,
        action: "QR_EMAIL_SENT",
        result: emailSent ? "SUCCESS" : "FAILURE",
        targetType: "visit",
        targetId: visit.id,
        ip: ctx.ip,
        requestId: ctx.requestId,
        meta: { provider: "resend" },
      });
    }

    return {
      success: true,
      message: "Visitor registered successfully!",
      data: {
        visitorId: visitor.id,
        visitId: visit.id,
        qrCode,
        emailSent,
        emailTo,
      },
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "VISITOR_REGISTER_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to register visitor. Please try again." };
  }
}

export async function checkInAction(visitId: string): Promise<VisitActionState> {
  const auth = await guard("visit:transition", "VISIT_CHECKED_IN", visitId);
  if (!auth) return DENIED;

  const id = uuidSchema.safeParse(visitId);
  if (!id.success) return { success: false, message: "Invalid visit." };

  try {
    const visit = await db.visit.findUnique({
      where: { id: id.data },
      select: { id: true, status: true, qrRevokedAt: true },
    });
    if (!visit) return { success: false, message: "Visit not found." };

    const transition = await transitionVisit(visit, "CHECKED_IN");
    if (!transition.ok) return { success: false, message: transition.message };

    await db.visit.update({
      where: { id: visit.id },
      data: { status: "CHECKED_IN", actualArrival: transition.at, checkedInById: auth.user.userId },
    });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "VISIT_CHECKED_IN",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visit.id,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/scanner");
    revalidatePath("/visitors");
    revalidatePath("/visitors/[id]", "page");
    return { success: true, message: "Visitor checked in successfully!" };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "CHECKIN_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to check in." };
  }
}

export async function checkOutAction(visitId: string): Promise<VisitActionState> {
  const auth = await guard("visit:transition", "VISIT_CHECKED_OUT", visitId);
  if (!auth) return DENIED;

  const id = uuidSchema.safeParse(visitId);
  if (!id.success) return { success: false, message: "Invalid visit." };

  try {
    const visit = await db.visit.findUnique({
      where: { id: id.data },
      select: { id: true, status: true, qrRevokedAt: true },
    });
    if (!visit) return { success: false, message: "Visit not found." };

    const transition = await transitionVisit(visit, "CHECKED_OUT");
    if (!transition.ok) return { success: false, message: transition.message };

    await db.visit.update({
      where: { id: visit.id },
      data: {
        status: "CHECKED_OUT",
        actualDeparture: transition.at,
        checkedOutById: auth.user.userId,
      },
    });
    await db.visitStop.updateMany({
      where: { visitId: visit.id, checkedInAt: { not: null }, checkedOutAt: null },
      data: { checkedOutAt: transition.at },
    });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "VISIT_CHECKED_OUT",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visit.id,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/scanner");
    revalidatePath("/visitors");
    revalidatePath("/visitors/[id]", "page");
    return { success: true, message: "Visitor checked out successfully!" };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "CHECKOUT_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to check out." };
  }
}

export async function cancelVisitAction(visitId: string): Promise<VisitActionState> {
  const auth = await guard("visit:transition", "VISIT_CANCELLED", visitId);
  if (!auth) return DENIED;

  const id = uuidSchema.safeParse(visitId);
  if (!id.success) return { success: false, message: "Invalid visit." };

  try {
    const visit = await db.visit.findUnique({
      where: { id: id.data },
      select: { id: true, status: true, qrRevokedAt: true },
    });
    if (!visit) return { success: false, message: "Visit not found." };

    const transition = await transitionVisit(visit, "CANCELLED");
    if (!transition.ok) return { success: false, message: transition.message };

    await db.visit.update({ where: { id: visit.id }, data: { status: "CANCELLED" } });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "VISIT_CANCELLED",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visit.id,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
    });

    revalidatePath("/dashboard");
    revalidatePath("/scanner");
    revalidatePath("/visitors");
    revalidatePath("/visitors/[id]", "page");
    return { success: true, message: "Visit cancelled." };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "CANCEL_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to cancel visit." };
  }
}

const addStopSchema = z
  .object({
    visitId: uuidSchema,
    departmentId: uuidSchema,
    building: z.string().trim().max(120).optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export async function addVisitStopAction(
  visitId: string,
  departmentId: string,
  building?: string,
  notes?: string
): Promise<VisitActionState> {
  const auth = await guard("visit:transition", "VISIT_STOP_ADDED", visitId);
  if (!auth) return DENIED;

  const parsed = addStopSchema.safeParse({ visitId, departmentId, building, notes });
  if (!parsed.success) return { success: false, message: "Invalid stop details." };

  try {
    const visit = await db.visit.findUnique({
      where: { id: parsed.data.visitId },
      select: { id: true, status: true },
    });
    if (!visit) return { success: false, message: "Visit not found." };
    if (visit.status !== "CHECKED_IN") {
      return { success: false, message: "Stops can only be logged while a visit is checked in." };
    }

    const department = await db.department.findUnique({
      where: { id: parsed.data.departmentId },
      select: { id: true, isActive: true },
    });
    if (!department || !department.isActive) {
      return { success: false, message: "The selected department is unavailable." };
    }

    await db.visitStop.create({
      data: {
        visitId: parsed.data.visitId,
        departmentId: parsed.data.departmentId,
        building: parsed.data.building,
        checkedInAt: new Date(),
        notes: parsed.data.notes,
      },
    });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "VISIT_STOP_ADDED",
      result: "SUCCESS",
      targetType: "visit",
      targetId: parsed.data.visitId,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
      meta: { departmentId: parsed.data.departmentId },
    });

    revalidatePath("/scanner");
    return { success: true, message: "Stop logged." };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "ADD_STOP_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to log stop." };
  }
}

export async function checkOutStopAction(stopId: string): Promise<VisitActionState> {
  const auth = await guard("visit:transition", "VISIT_STOP_CHECKED_OUT", stopId);
  if (!auth) return DENIED;

  const id = uuidSchema.safeParse(stopId);
  if (!id.success) return { success: false, message: "Invalid stop." };

  try {
    const stop = await db.visitStop.findUnique({
      where: { id: id.data },
      select: { id: true, checkedOutAt: true },
    });
    if (!stop) return { success: false, message: "Stop not found." };
    if (stop.checkedOutAt) {
      return { success: false, message: "Stop was already checked out." };
    }

    await db.visitStop.update({
      where: { id: stop.id },
      data: { checkedOutAt: new Date() },
    });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "VISIT_STOP_CHECKED_OUT",
      result: "SUCCESS",
      targetType: "visitStop",
      targetId: stop.id,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
    });

    revalidatePath("/scanner");
    return { success: true, message: "Stop checked out." };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "CHECKOUT_STOP_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to check out stop." };
  }
}

export async function deleteVisitorAction(visitorId: string): Promise<VisitActionState> {
  const auth = await guard("visitor:delete", "VISITOR_DELETED", visitorId);
  if (!auth) return DENIED;

  const id = uuidSchema.safeParse(visitorId);
  if (!id.success) return { success: false, message: "Invalid visitor." };

  try {
    const visitor = await db.visitor.findUnique({ where: { id: id.data }, select: { id: true } });
    if (!visitor) return { success: false, message: "Visitor not found." };

    await db.visitStop.deleteMany({ where: { visit: { visitorId: visitor.id } } });
    await db.visit.deleteMany({ where: { visitorId: visitor.id } });
    await db.visitor.delete({ where: { id: visitor.id } });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "VISITOR_DELETED",
      result: "SUCCESS",
      targetType: "visitor",
      targetId: visitor.id,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
    });

    revalidatePath("/visitors");
    revalidatePath("/dashboard");
    return { success: true, message: "Visitor deleted." };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "DELETE_VISITOR_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to delete visitor." };
  }
}

/** Revokes a visit's QR credential so it can no longer look up or check in. */
export async function revokeQrAction(visitId: string): Promise<VisitActionState> {
  const auth = await guard("visit:revoke-qr", "QR_REVOKED", visitId);
  if (!auth) return DENIED;

  const id = uuidSchema.safeParse(visitId);
  if (!id.success) return { success: false, message: "Invalid visit." };

  try {
    const visit = await db.visit.findUnique({
      where: { id: id.data },
      select: { id: true, qrRevokedAt: true },
    });
    if (!visit) return { success: false, message: "Visit not found." };
    if (visit.qrRevokedAt) return { success: false, message: "QR code is already revoked." };

    await db.visit.update({ where: { id: visit.id }, data: { qrRevokedAt: new Date() } });

    await recordAudit({
      actorId: auth.user.userId,
      actorEmail: auth.user.email,
      action: "QR_REVOKED",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visit.id,
      ip: auth.ctx.ip,
      userAgent: auth.ctx.userAgent,
      requestId: auth.ctx.requestId,
    });

    revalidatePath("/visitors");
    revalidatePath("/scanner");
    return { success: true, message: "QR code revoked." };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "QR_REVOKE_ERROR",
        requestId: auth.ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to revoke QR code." };
  }
}
