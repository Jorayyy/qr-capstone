import { createHash, randomBytes, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { intFromEnv } from "@/lib/env";
import { can, type Permission } from "@/lib/rbac";
import { portalHome } from "@/lib/portal";

export const SESSION_COOKIE = "vms-session";
const LAST_SEEN_THROTTLE_MS = 60_000;
const MFA_PENDING_TTL_MS = 5 * 60 * 1000;

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
};

export type RequestCtx = {
  ip: string | null;
  userAgent: string | null;
  requestId: string;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function idleMs(): number {
  return intFromEnv("SESSION_IDLE_MINUTES", 120, 1, 60 * 24 * 7) * 60_000;
}

function absoluteMs(): number {
  return intFromEnv("SESSION_ABSOLUTE_HOURS", 16, 1, 24 * 30) * 3_600_000;
}

/** IP / user-agent / correlation id of the current request (server actions, pages, routes). */
export async function getRequestContext(): Promise<RequestCtx> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : h.get("x-real-ip");
    const userAgent = h.get("user-agent");
    const requestId = h.get("x-request-id") ?? randomUUID();
    return { ip: ip || null, userAgent, requestId };
  } catch {
    return { ip: null, userAgent: null, requestId: randomUUID() };
  }
}

async function setSessionCookie(token: string, maxAgeSeconds: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

export async function createSession(
  userId: string,
  opts: { mfaPending?: boolean; ip?: string | null; userAgent?: string | null } = {}
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const ttlMs = opts.mfaPending ? MFA_PENDING_TTL_MS : absoluteMs();

  await db.session.create({
    data: {
      tokenHash: sha256(token),
      userId,
      idleExpiresAt: new Date(now + ttlMs),
      absoluteExpiresAt: new Date(now + ttlMs),
      mfaPending: opts.mfaPending ?? false,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ? opts.userAgent.slice(0, 300) : null,
    },
  });

  await setSessionCookie(token, Math.floor(ttlMs / 1000));
}

type SessionRow = {
  id: string;
  mfaPending: boolean;
  lastSeenAt: Date;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    mfaEnabled: boolean;
  };
};

async function loadSessionRow(): Promise<SessionRow | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || token.length < 20 || token.length > 200) return null;

  const row = (await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          mustChangePassword: true,
          mfaEnabled: true,
        },
      },
    },
  })) as SessionRow | null;

  if (!row) return null;
  if (row.revokedAt) return null;

  const now = Date.now();
  if (row.absoluteExpiresAt.getTime() < now) return null;
  if (row.idleExpiresAt.getTime() < now) return null;

  if (!row.user.isActive) {
    // Deactivated accounts lose access immediately, not at token expiry.
    await db.session.updateMany({
      where: { userId: row.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Sliding idle timeout, throttled to at most one write per minute.
  if (row.lastSeenAt.getTime() < now - LAST_SEEN_THROTTLE_MS) {
    await db.session.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date(), idleExpiresAt: new Date(now + idleMs()) },
    });
  }

  return row;
}

/**
 * Returns the authenticated user for the current request, or null.
 * Always reads role/isActive fresh from the database — never trusts the cookie.
 */
export async function getSession(): Promise<SessionUser | null> {
  const row = await loadSessionRow();
  if (!row || row.mfaPending) return null;
  return {
    userId: row.user.id,
    email: row.user.email,
    name: row.user.name,
    role: row.user.role,
    mustChangePassword: row.user.mustChangePassword,
    mfaEnabled: row.user.mfaEnabled,
  };
}

/**
 * Page guard: redirects anonymous users to /login. For layouts/pages only —
 * actions and API routes must use getSession() and return their own errors.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  return user;
}

/**
 * Page guard: authenticated AND permission-checked. Permission failures land
 * on /dashboard rather than leaking page existence.
 */
export async function requirePermission(...permissions: Permission[]): Promise<SessionUser> {
  const user = await getSession();
  if (!user) redirect("/login");
  const allowed = permissions.every((p) => can(user.role, p));
  if (!allowed) redirect(portalHome(user.role));
  return user;
}

/** Destroys the current session row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } })
      .catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

/** Revokes every session for a user (password change, admin action, disable). */
export async function revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
  await db.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}),
    },
    data: { revokedAt: new Date() },
  });
}

/**
 * Finds the short-lived MFA-pending session bound to the current cookie.
 * Used only by the second step of login.
 */
export async function getPendingMfaSession(): Promise<{ id: string; userId: string } | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, userId: true, mfaPending: true, revokedAt: true, absoluteExpiresAt: true },
  });

  if (!row || !row.mfaPending || row.revokedAt) return null;
  if (row.absoluteExpiresAt.getTime() < Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

/**
 * Promotes an MFA-pending session to fully active and rotates the cookie token
 * (session fixation defense).
 */
export async function activateMfaSession(sessionId: string): Promise<void> {
  const newToken = randomBytes(32).toString("base64url");
  const now = Date.now();

  await db.session.update({
    where: { id: sessionId },
    data: {
      tokenHash: sha256(newToken),
      mfaPending: false,
      lastSeenAt: new Date(now),
      idleExpiresAt: new Date(now + idleMs()),
      absoluteExpiresAt: new Date(now + absoluteMs()),
    },
  });

  await setSessionCookie(newToken, Math.floor(absoluteMs() / 1000));
}

/** Immediately kills the MFA-pending session (too many codes, cancel, expiry). */
export async function revokePendingMfaSession(sessionId: string): Promise<void> {
  await db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
