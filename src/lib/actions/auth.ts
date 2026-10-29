"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  activateMfaSession,
  createSession,
  destroySession,
  getPendingMfaSession,
  getRequestContext,
  getSession,
  revokeAllSessions,
  revokePendingMfaSession,
} from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { LIMITS, WINDOWS, rateLimit } from "@/lib/rate-limit";
import {
  breachedPasswordCount,
  equalizeLoginTiming,
  hashPassword,
  passwordSchemaFor,
  verifyPassword,
} from "@/lib/password";
import { consumeRecoveryCode, decryptSecret, verifyTotp } from "@/lib/mfa";
import { portalHome } from "@/lib/portal";
import { changePasswordSchema, formString, loginSchema, mfaCodeSchema, safeCallbackUrl } from "@/lib/validation";

export type LoginState =
  | { error?: string; mfaRequired?: boolean; lockoutMinutes?: number }
  | null;

export type MfaState = { error?: string } | null;
export type PasswordState = { error?: string; success?: boolean } | null;

const LOCK_STEPS_MINUTES = [1, 5, 15, 30];
const LOCK_EVERY = 5;

function lockMinutesForFailedCount(failedLogins: number): number {
  const step = Math.floor(failedLogins / LOCK_EVERY) - 1;
  return LOCK_STEPS_MINUTES[Math.min(Math.max(step, 0), LOCK_STEPS_MINUTES.length - 1)];
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const ctx = await getRequestContext();

  const ipLimit = await rateLimit(
    `login:ip:${ctx.ip ?? "unknown"}`,
    LIMITS.loginPerIp(),
    WINDOWS.short
  );
  if (!ipLimit.ok) {
    console.log(
      JSON.stringify({
        level: "warn",
        event: "LOGIN_RATE_LIMITED",
        ip: ctx.ip,
        requestId: ctx.requestId,
      })
    );
    return { error: "Too many sign-in attempts. Please wait and try again." };
  }

  const parsed = loginSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });
  if (!parsed.success) {
    await recordAudit({
      action: "LOGIN_FAILED",
      result: "FAILURE",
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { reason: "invalid_input" },
    });
    return { error: "Invalid email or password." };
  }
  const { email, password } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { email } });

    if (!user) {
      await equalizeLoginTiming(password);
      await recordAudit({
        actorEmail: email,
        action: "LOGIN_FAILED",
        result: "FAILURE",
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        meta: { reason: "unknown_account" },
      });
      return { error: "Invalid email or password." };
    }

    const now = new Date();
    const isLocked = Boolean(user.lockedUntil && user.lockedUntil > now);
    const { valid, needsRehash } = await verifyPassword(user.passwordHash, password);

    if (!valid) {
      // While locked, do not count attempts (prevents lock extension abuse).
      if (!isLocked) {
        const failedLogins = user.failedLogins + 1;
        const shouldLock = failedLogins % LOCK_EVERY === 0;
        const lockMinutes = shouldLock ? lockMinutesForFailedCount(failedLogins) : 0;
        await db.user.update({
          where: { id: user.id },
          data: {
            failedLogins,
            ...(shouldLock ? { lockedUntil: new Date(now.getTime() + lockMinutes * 60_000) } : {}),
          },
        });
        await recordAudit({
          actorId: user.id,
          actorEmail: user.email,
          action: shouldLock ? "LOGIN_LOCKED" : "LOGIN_FAILED",
          result: "FAILURE",
          targetType: "user",
          targetId: user.id,
          ip: ctx.ip,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
          meta: { reason: "bad_password", failedLogins, ...(shouldLock ? { lockMinutes } : {}) },
        });
      }
      // Generic error for unknown account and wrong password alike (no enumeration).
      return { error: "Invalid email or password." };
    }

    if (needsRehash) {
      // Seamless upgrade of legacy bcrypt hashes to Argon2id on next login.
      await db.user
        .update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } })
        .catch(() => {});
    }

    if (!user.isActive) {
      // Only revealed after the password proved correct — not an enumeration vector.
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: "LOGIN_FAILED",
        result: "FAILURE",
        targetType: "user",
        targetId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        meta: { reason: "account_disabled" },
      });
      return { error: "This account is deactivated. Contact an administrator." };
    }

    if (isLocked) {
      const minutesLeft = Math.max(Math.ceil(((user.lockedUntil?.getTime() ?? 0) - now.getTime()) / 60_000), 1);
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: "LOGIN_FAILED",
        result: "FAILURE",
        targetType: "user",
        targetId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        meta: { reason: "locked_out" },
      });
      return {
        error: `Too many failed sign-in attempts. Try again in about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        lockoutMinutes: minutesLeft,
      };
    }

    const accountLimit = await rateLimit(
      `login:acct:${user.id}`,
      LIMITS.loginPerAccount(),
      WINDOWS.medium
    );
    if (!accountLimit.ok) {
      console.log(
        JSON.stringify({
          level: "warn",
          event: "LOGIN_ACCOUNT_RATE_LIMITED",
          userId: user.id,
          requestId: ctx.requestId,
        })
      );
      return { error: "Too many sign-in attempts. Please wait and try again." };
    }

    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
    });

    if (user.mfaEnabled && user.mfaSecret) {
      await createSession(user.id, { mfaPending: true, ip: ctx.ip, userAgent: ctx.userAgent });
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: "MFA_CHALLENGE",
        result: "SUCCESS",
        targetType: "user",
        targetId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
      });
      return { mfaRequired: true };
    }

    await createSession(user.id, { ip: ctx.ip, userAgent: ctx.userAgent });
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "LOGIN_SUCCESS",
      result: "SUCCESS",
      targetType: "user",
      targetId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
    revalidatePath("/");
    redirect(safeCallbackUrl(formString(formData, "callbackUrl")) ?? portalHome(user.role));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error(
      JSON.stringify({
        level: "error",
        event: "LOGIN_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Invalid email or password." };
  }
}

export async function verifyMfaAction(
  _prevState: MfaState,
  formData: FormData
): Promise<MfaState> {
  const ctx = await getRequestContext();
  const pending = await getPendingMfaSession();
  if (!pending) {
    return { error: "Session expired. Please sign in again." };
  }

  const attemptLimit = await rateLimit(
    `mfa:sess:${pending.id}`,
    LIMITS.mfaPerSession(),
    WINDOWS.short
  );
  if (!attemptLimit.ok) {
    await revokePendingMfaSession(pending.id);
    await recordAudit({
      actorId: pending.userId,
      action: "MFA_FAILED",
      result: "FAILURE",
      targetType: "user",
      targetId: pending.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: { reason: "too_many_attempts" },
    });
    return { error: "Too many incorrect codes. Please sign in again." };
  }

  const parsed = mfaCodeSchema.safeParse({ code: formString(formData, "code") });
  if (!parsed.success) {
    return { error: "Enter the 6-digit code from your authenticator app." };
  }
  const code = parsed.data.code;

  try {
    const user = await db.user.findUnique({
      where: { id: pending.userId },
      select: { id: true, email: true, role: true, mfaEnabled: true, mfaSecret: true, mfaRecoveryCodes: true, isActive: true },
    });
    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
      await revokePendingMfaSession(pending.id);
      return { error: "Sign-in could not be completed. Please sign in again." };
    }

    let verified = false;
    let usedRecovery = false;

    try {
      verified = verifyTotp(decryptSecret(user.mfaSecret), code);
    } catch {
      verified = false;
    }

    if (!verified && user.mfaRecoveryCodes) {
      const updated = consumeRecoveryCode(user.mfaRecoveryCodes, code);
      if (updated) {
        await db.user.update({ where: { id: user.id }, data: { mfaRecoveryCodes: updated } });
        verified = true;
        usedRecovery = true;
      }
    }

    if (!verified) {
      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: "MFA_FAILED",
        result: "FAILURE",
        targetType: "user",
        targetId: user.id,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        meta: { reason: "bad_code" },
      });
      return { error: "Incorrect code. Try again." };
    }

    await activateMfaSession(pending.id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: "MFA_SUCCESS",
      result: "SUCCESS",
      targetType: "user",
      targetId: user.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
      meta: usedRecovery ? { via: "recovery_code" } : { via: "totp" },
    });
    revalidatePath("/");
    redirect(safeCallbackUrl(formString(formData, "callbackUrl")) ?? portalHome(user.role));
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error(
      JSON.stringify({
        level: "error",
        event: "MFA_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Verification failed. Please try again." };
  }
}

export async function changePasswordAction(
  _prevState: PasswordState,
  formData: FormData
): Promise<PasswordState> {
  const ctx = await getRequestContext();
  const user = await getSession();
  if (!user) {
    return { error: "Not authorized." };
  }

  const limit = await rateLimit(`pwdchg:${user.userId}`, LIMITS.passwordChange(), WINDOWS.medium);
  if (!limit.ok) {
    return { error: "Too many attempts. Please wait and try again." };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formString(formData, "currentPassword"),
    newPassword: formString(formData, "newPassword"),
  });
  if (!parsed.success) {
    return { error: "Enter your current password and a new password." };
  }

  const policy = passwordSchemaFor(user.email).safeParse(parsed.data.newPassword);
  if (!policy.success) {
    return { error: policy.error.issues[0]?.message ?? "Password does not meet requirements." };
  }
  if (parsed.data.newPassword === parsed.data.currentPassword) {
    return { error: "New password must be different from your current password." };
  }

  try {
    const dbUser = await db.user.findUnique({ where: { id: user.userId } });
    if (!dbUser) return { error: "Not authorized." };

    const { valid } = await verifyPassword(dbUser.passwordHash, parsed.data.currentPassword);
    if (!valid) {
      await recordAudit({
        actorId: user.userId,
        actorEmail: user.email,
        action: "PASSWORD_CHANGE_FAILED",
        result: "FAILURE",
        targetType: "user",
        targetId: user.userId,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        requestId: ctx.requestId,
        meta: { reason: "bad_current_password" },
      });
      return { error: "Current password is incorrect." };
    }

    const breached = await breachedPasswordCount(parsed.data.newPassword);
    if (breached !== null && breached > 0) {
      return {
        error: "This password appears in known data breaches. Choose a different password.",
      };
    }
    if (breached === null) {
      console.log(
        JSON.stringify({ level: "warn", event: "HIBP_UNAVAILABLE", requestId: ctx.requestId })
      );
    }

    const newHash = await hashPassword(parsed.data.newPassword);

    await db.user.update({
      where: { id: dbUser.id },
      data: {
        passwordHash: newHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLogins: 0,
        lockedUntil: null,
      },
    });

    // Invalidate every existing session, then issue a fresh one (rotation).
    await revokeAllSessions(dbUser.id);
    await createSession(dbUser.id, { ip: ctx.ip, userAgent: ctx.userAgent });

    await recordAudit({
      actorId: dbUser.id,
      actorEmail: dbUser.email,
      action: "PASSWORD_CHANGED",
      result: "SUCCESS",
      targetType: "user",
      targetId: dbUser.id,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "PASSWORD_CHANGE_ERROR",
        requestId: ctx.requestId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { error: "Could not change password. Please try again." };
  }
}

export async function logoutAction(): Promise<void> {
  const ctx = await getRequestContext();
  const user = await getSession();
  await destroySession();
  if (user) {
    await recordAudit({
      actorId: user.userId,
      actorEmail: user.email,
      action: "LOGOUT",
      result: "SUCCESS",
      targetType: "user",
      targetId: user.userId,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
      requestId: ctx.requestId,
    });
  }
  redirect("/login");
}

function isRedirectError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}
