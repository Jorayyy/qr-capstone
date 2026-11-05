"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getRequestContext, requirePermission, revokeAllSessions } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import { breachedPasswordCount, hashPassword, passwordSchemaFor } from "@/lib/password";
import {
  createUserSchema,
  formString,
  userDepartmentSchema,
  userRoleSchema,
  uuidSchema,
} from "@/lib/validation";
import { randomBytes } from "crypto";

export type AdminUserState = {
  error?: string;
  success?: string;
  tempPassword?: string;
} | null;

async function guard(action: string) {
  const actor = await requirePermission("users:manage");
  const ctx = await getRequestContext();
  const limit = await rateLimit(`admin:${actor.userId}:${action}`, LIMITS.searchPerUser(), WINDOWS.short);
  if (!limit.ok) {
    return { error: "Too many admin actions. Please wait a moment." as const };
  }
  return { actor, ctx };
}

function parseTargetId(formData: FormData): string | null {
  const parsed = uuidSchema.safeParse(formString(formData, "userId"));
  return parsed.success ? parsed.data : null;
}

export async function createUserAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("create-user");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const parsed = createUserSchema.safeParse({
    email: formString(formData, "email"),
    name: formString(formData, "name"),
    role: formString(formData, "role"),
    password: formString(formData, "password") || undefined,
    departmentId: formString(formData, "departmentId") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { email, name, role, departmentId } = parsed.data;

  try {
    const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) return { error: "A user with that email already exists." };

    let tempPassword: string;
    if (parsed.data.password && parsed.data.password.length > 0) {
      tempPassword = parsed.data.password;
      const policy = passwordSchemaFor(email).safeParse(tempPassword);
      if (!policy.success) {
        return { error: policy.error.issues[0]?.message ?? "Password does not meet requirements." };
      }
    } else {
      tempPassword = randomBytes(18).toString("base64url");
    }

    const breached = await breachedPasswordCount(tempPassword);
    if (breached !== null && breached > 0) {
      return { error: "That password appears in known data breaches. Choose a different one." };
    }

    const user = await db.user.create({
      data: {
        email,
        name,
        role,
        departmentId: departmentId ?? null,
        passwordHash: await hashPassword(tempPassword),
        mustChangePassword: true,
      },
      select: { id: true },
    });

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "USER_CREATED",
      result: "SUCCESS",
      targetType: "user",
      targetId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email, role, departmentId: departmentId ?? null },
    });

    revalidatePath("/security");
    return {
      success: `Created ${email}. They must change the password at first sign-in.`,
      tempPassword,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "USER_CREATE_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not create the user. Please try again." };
  }
}

export async function setUserRoleAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("set-role");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };
  if (targetId === actor.userId) return { error: "You cannot change your own role." };

  const parsed = userRoleSchema.safeParse({
    userId: targetId,
    role: formString(formData, "role"),
  });
  if (!parsed.success) return { error: "Invalid role." };

  try {
    const target = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, role: true },
    });
    if (!target) return { error: "User not found." };
    if (target.role === parsed.data.role) return { success: "Role unchanged." };

    await db.user.update({
      where: { id: target.id },
      data: { role: parsed.data.role },
    });
    await revokeAllSessions(target.id);

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "USER_ROLE_CHANGED",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email: target.email, from: target.role, to: parsed.data.role },
    });

    revalidatePath("/security");
    return { success: `Role updated for ${target.email}. Their sessions were signed out.` };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "USER_ROLE_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not update the role. Please try again." };
  }
}

export async function setUserDepartmentAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("set-department");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };

  const parsed = userDepartmentSchema.safeParse({
    userId: targetId,
    departmentId: formString(formData, "departmentId") || null,
  });
  if (!parsed.success) return { error: "Invalid office." };

  try {
    const target = await db.user.findUnique({
      where: { id: parsed.data.userId },
      select: { id: true, email: true, departmentId: true },
    });
    if (!target) return { error: "User not found." };

    const department = parsed.data.departmentId
      ? await db.department.findUnique({
          where: { id: parsed.data.departmentId },
          select: { id: true, name: true },
        })
      : null;
    if (parsed.data.departmentId && !department) return { error: "Office not found." };
    if (target.departmentId === (department?.id ?? null)) return { success: "Office unchanged." };

    await db.user.update({
      where: { id: target.id },
      data: { departmentId: department?.id ?? null },
    });

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "USER_DEPARTMENT_CHANGED",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: {
        email: target.email,
        from: target.departmentId,
        to: department?.id ?? null,
      },
    });

    revalidatePath("/admin/security");
    return {
      success: department
        ? `${department.name} set as the office for ${target.email}.`
        : `Office cleared for ${target.email}.`,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "USER_DEPARTMENT_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not update the office. Please try again." };
  }
}

export async function setUserActiveAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("set-active");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };
  if (targetId === actor.userId) return { error: "You cannot deactivate your own account." };

  const active = formString(formData, "active") === "true";

  try {
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, isActive: true },
    });
    if (!target) return { error: "User not found." };
    if (target.isActive === active) return { success: "No change." };

    await db.user.update({
      where: { id: target.id },
      data: {
        isActive: active,
        ...(active ? { failedLogins: 0, lockedUntil: null } : {}),
      },
    });
    if (!active) await revokeAllSessions(target.id);

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email: target.email },
    });

    revalidatePath("/security");
    return { success: active ? `${target.email} activated.` : `${target.email} deactivated and signed out.` };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "USER_ACTIVE_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not update the account. Please try again." };
  }
}

export async function unlockUserAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("unlock");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };

  try {
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true },
    });
    if (!target) return { error: "User not found." };

    await db.user.update({
      where: { id: target.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "USER_UNLOCKED",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email: target.email },
    });

    revalidatePath("/security");
    return { success: `${target.email} unlocked.` };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "USER_UNLOCK_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not unlock the user. Please try again." };
  }
}

export async function adminResetPasswordAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("reset-password");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };

  try {
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true },
    });
    if (!target) return { error: "User not found." };

    const tempPassword = randomBytes(18).toString("base64url");

    await db.user.update({
      where: { id: target.id },
      data: {
        passwordHash: await hashPassword(tempPassword),
        passwordChangedAt: null,
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
      },
    });
    await revokeAllSessions(target.id);

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "PASSWORD_RESET",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email: target.email },
    });

    revalidatePath("/security");
    return {
      success: `Password reset for ${target.email}. All sessions were signed out.`,
      tempPassword,
    };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "PASSWORD_RESET_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not reset the password. Please try again." };
  }
}

export async function adminResetMfaAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("reset-mfa");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };

  try {
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (!target) return { error: "User not found." };
    if (!target.mfaEnabled && !target.email) return { error: "User not found." };

    await db.user.update({
      where: { id: target.id },
      data: { mfaEnabled: false, mfaSecret: null, mfaRecoveryCodes: null, mfaEnrolledAt: null },
    });

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "MFA_RESET",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email: target.email },
    });

    revalidatePath("/security");
    return { success: `MFA reset for ${target.email}.` };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "MFA_RESET_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not reset MFA. Please try again." };
  }
}

export async function revokeUserSessionsAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("revoke-sessions");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const targetId = parseTargetId(formData);
  if (!targetId) return { error: "Invalid user." };
  if (targetId === actor.userId) {
    return { error: "Use logout to end your own sessions." };
  }

  try {
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true },
    });
    if (!target) return { error: "User not found." };

    await revokeAllSessions(target.id);

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "SESSIONS_REVOKED",
      result: "SUCCESS",
      targetType: "user",
      targetId: target.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { email: target.email },
    });

    revalidatePath("/security");
    return { success: `All sessions revoked for ${target.email}.` };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "SESSIONS_REVOKE_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not revoke sessions. Please try again." };
  }
}

export async function revokeSessionAction(
  _prev: AdminUserState,
  formData: FormData
): Promise<AdminUserState> {
  const g = await guard("revoke-session");
  if ("error" in g) return g;
  const { actor, ctx } = g;

  const sessionId = parseTargetId(formData);
  if (!sessionId) return { error: "Invalid session." };

  try {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, user: { select: { email: true } } },
    });
    if (!session) return { error: "Session not found." };
    if (session.userId === actor.userId) return { error: "Use logout to end your own session." };

    await db.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    await recordAudit({
      actorId: actor.userId,
      actorEmail: actor.email,
      action: "SESSION_REVOKED",
      result: "SUCCESS",
      targetType: "session",
      targetId: session.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { userEmail: session.user.email },
    });

    revalidatePath("/security");
    return { success: "Session revoked." };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "SESSION_REVOKE_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not revoke the session. Please try again." };
  }
}
