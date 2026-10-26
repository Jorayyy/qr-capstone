"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRequestContext } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { emailEnabled, sendQrEmail } from "@/lib/email";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import { isUniqueViolation, nextReferenceCode } from "@/lib/reference";
import { resolveVisitWindow } from "@/lib/registration";
import { publicRegistrationSchema } from "@/lib/validation";

export type PublicRegistrationState = {
  success: boolean;
  message: string;
  data?: {
    referenceCode: string;
    qrCode: string;
    visitId: string;
    passPath: string;
    validFrom: string;
    validUntil: string;
    emailSent: boolean;
    emailTo: string;
  };
};

const MAX_REFERENCE_ATTEMPTS = 5;

/**
 * Public pre-registration. Unauthenticated by design — every field is
 * validated, uploads are separate and rate-limited, and no record is exposed
 * back except the caller's own reference/pass code.
 */
export async function registerPublicAction(input: unknown): Promise<PublicRegistrationState> {
  const ctx = await getRequestContext();

  const ipLimit = await rateLimit(
    `register:ip:${ctx.ip ?? "unknown"}`,
    LIMITS.registerPerIp(),
    WINDOWS.hour
  );
  const globalLimit = await rateLimit("register:global", LIMITS.registerGlobal(), WINDOWS.hour);
  if (!ipLimit.ok || !globalLimit.ok) {
    await recordAudit({
      action: "VISITOR_PREREGISTERED",
      result: "DENIED",
      targetType: "action",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { reason: "rate_limited" },
    });
    return {
      success: false,
      message: "Too many registrations from this device. Please try again later.",
    };
  }

  const parsed = publicRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Please check the form and try again.",
    };
  }
  const data = parsed.data;

  const window = resolveVisitWindow({
    visitType: data.visitType,
    validFrom: data.validFrom,
    validUntil: data.validUntil,
  });
  if (!window.ok) return { success: false, message: window.message };

  const uniqueDepartmentIds = [...new Set(data.offices.map((office) => office.departmentId))];
  if (uniqueDepartmentIds.length !== data.offices.length) {
    return { success: false, message: "Each office can only be selected once." };
  }

  const departments = await db.department.findMany({
    where: { id: { in: uniqueDepartmentIds }, isActive: true },
    select: { id: true, name: true, building: true },
  });
  if (departments.length !== uniqueDepartmentIds.length) {
    return { success: false, message: "One of the selected offices is unavailable." };
  }
  const departmentById = new Map(departments.map((department) => [department.id, department]));

  const qrCode = `VMS-${randomBytes(16).toString("hex").toUpperCase()}`;

  try {
    let visitor = await db.visitor.findFirst({ where: { email: data.email } });
    if (visitor) {
      visitor = await db.visitor.update({
        where: { id: visitor.id },
        data: {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          phone: data.phone,
          affiliation: data.affiliation,
          dateOfBirth: data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00Z`) : null,
          idType: data.idType,
          idNumber: data.idNumber,
          ...(data.photoUrl ? { photoUrl: data.photoUrl } : {}),
          ...(data.idPhotoUrl ? { idPhotoUrl: data.idPhotoUrl } : {}),
        },
      });
    } else {
      visitor = await db.visitor.create({
        data: {
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          affiliation: data.affiliation,
          dateOfBirth: data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00Z`) : null,
          idType: data.idType,
          idNumber: data.idNumber,
          photoUrl: data.photoUrl,
          idPhotoUrl: data.idPhotoUrl,
        },
      });
    }

    const primary = data.offices[0];
    let visitId = "";
    let referenceCode = "";

    for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
      const candidate = await nextReferenceCode();
      try {
        const visit = await db.$transaction(async (tx) => {
          const created = await tx.visit.create({
            data: {
              referenceCode: candidate,
              visitorId: visitor.id,
              departmentId: primary.departmentId,
              purpose: primary.purpose,
              status: "PENDING",
              method: "PRE_REGISTERED",
              visitType: data.visitType,
              expectedArrival: window.window.validFrom,
              validFrom: window.window.validFrom,
              qrCode,
              qrExpiresAt: window.window.validUntil,
              hostName: primary.hostName,
              vehicleType: data.vehicleType,
              vehicleModel: data.vehicleModel,
              vehicleColor: data.vehicleColor,
              vehiclePlateNumber: data.vehiclePlateNumber,
            },
          });

          await tx.visitStop.createMany({
            data: data.offices.map((office) => ({
              visitId: created.id,
              departmentId: office.departmentId,
              building: departmentById.get(office.departmentId)?.building ?? null,
              purpose: office.purpose,
              hostName: office.hostName,
              hostPreference: office.hostPreference,
              notes: office.notes,
            })),
          });

          return created;
        });
        visitId = visit.id;
        referenceCode = candidate;
        break;
      } catch (error) {
        if (!isUniqueViolation(error) || attempt === MAX_REFERENCE_ATTEMPTS - 1) throw error;
      }
    }

    await recordAudit({
      action: "VISITOR_PREREGISTERED",
      result: "SUCCESS",
      targetType: "visit",
      targetId: visitId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { referenceCode, offices: data.offices.length, channel: "public" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/visitors");

    const passPath = `/pass/${qrCode}`;
    let emailSent = false;
    if (emailEnabled()) {
      emailSent = await sendQrEmail({
        to: data.email,
        visitorName: `${visitor.firstName} ${visitor.lastName}`,
        qrCode,
        referenceCode,
        visitType: data.visitType,
        offices: data.offices.map((office) => departmentById.get(office.departmentId)?.name ?? ""),
        validFrom: window.window.validFrom,
        expiresAt: window.window.validUntil,
        passUrl: passPath,
      });
      await recordAudit({
        action: "QR_EMAIL_SENT",
        result: emailSent ? "SUCCESS" : "FAILURE",
        targetType: "visit",
        targetId: visitId,
        ip: ctx.ip,
        requestId: ctx.requestId,
        meta: { channel: "public" },
      });
    }

    return {
      success: true,
      message: "Pre-registration submitted.",
      data: {
        referenceCode,
        qrCode,
        visitId,
        passPath,
        validFrom: window.window.validFrom.toISOString(),
        validUntil: window.window.validUntil.toISOString(),
        emailSent,
        emailTo: data.email,
      },
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "PUBLIC_REGISTRATION_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { success: false, message: "Failed to submit the registration. Please try again." };
  }
}
