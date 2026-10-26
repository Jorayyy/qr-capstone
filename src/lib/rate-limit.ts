import { db } from "@/lib/db";
import { intFromEnv } from "@/lib/env";

export type RateLimitOutcome =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number };

/**
 * In-memory short-circuit so an active attack stops hammering the database.
 * Best-effort only (per serverless instance); the DB counter stays authoritative.
 */
const locallyBlocked = new Map<string, number>(); // key -> window end (ms)

const PURGE_PROBABILITY = 0.01;
const COUNTER_RETENTION_MS = 24 * 60 * 60 * 1000;

function purgeOldCounters(): void {
  const cutoff = new Date(Date.now() - COUNTER_RETENTION_MS);
  db.rateLimit
    .deleteMany({ where: { windowStart: { lt: cutoff } } })
    .catch(() => {});
}

/**
 * Fixed-window counter stored in Postgres (works across serverless instances).
 *
 * `key` must be built server-side from trusted values (ip, account id, route) —
 * never directly from a client-supplied header.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<RateLimitOutcome> {
  const windowMs = windowSeconds * 1000;
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const retryAfterSeconds = Math.max(Math.ceil((windowStartMs + windowMs - Date.now()) / 1000), 1);

  const cachedEnd = locallyBlocked.get(key);
  if (cachedEnd !== undefined && cachedEnd > Date.now()) {
    return { ok: false, retryAfterSeconds: Math.max(Math.ceil((cachedEnd - Date.now()) / 1000), 1) };
  }

  try {
    const rows = await db.$queryRaw<{ count: number }[]>`
      INSERT INTO rate_limits (key, "windowStart", count)
      VALUES (${key}, ${windowStart}, 1)
      ON CONFLICT (key, "windowStart")
      DO UPDATE SET count = rate_limits.count + 1
      RETURNING count`;

    const count = rows[0]?.count ?? 1;
    if (Math.random() < PURGE_PROBABILITY) purgeOldCounters();

    if (count > limit) {
      locallyBlocked.set(key, windowStartMs + windowMs);
      return { ok: false, retryAfterSeconds };
    }
    return { ok: true, remaining: Math.max(limit - count, 0) };
  } catch (error) {
    // If the counter table is unavailable the app's DB is down too (auth would
    // fail regardless). Log and allow so a transient error does not lock out
    // every legitimate user.
    console.error(
      JSON.stringify({
        level: "error",
        event: "RATE_LIMIT_ERROR",
        key: key.split(":").slice(0, 2).join(":"),
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return { ok: true, remaining: -1 };
  }
}

/** Common window sizes used across the app (seconds). */
export const WINDOWS = {
  short: 300, // 5 minutes
  medium: 900, // 15 minutes
  hour: 3600, // 1 hour
} as const;

/** Standard limits, overridable via environment for operational tuning. */
export const LIMITS = {
  loginPerIp: () => intFromEnv("RATE_LOGIN_IP", 10, 1, 10_000),
  loginPerAccount: () => intFromEnv("RATE_LOGIN_ACCOUNT", 5, 1, 10_000),
  mfaPerSession: () => intFromEnv("RATE_MFA", 5, 1, 10_000),
  passwordChange: () => intFromEnv("RATE_PASSWORD_CHANGE", 5, 1, 10_000),
  lookupPerIp: () => intFromEnv("RATE_LOOKUP_IP", 30, 1, 100_000),
  lookupPerQr: () => intFromEnv("RATE_LOOKUP_QR", 10, 1, 100_000),
  lookupPerUser: () => intFromEnv("RATE_LOOKUP_USER", 120, 1, 100_000),
  checkinPerIp: () => intFromEnv("RATE_CHECKIN_IP", 30, 1, 100_000),
  checkinPerUser: () => intFromEnv("RATE_CHECKIN_USER", 120, 1, 100_000),
  registerPerIp: () => intFromEnv("RATE_REGISTER_IP", 30, 1, 100_000),
  registerPerUser: () => intFromEnv("RATE_REGISTER_USER", 120, 1, 100_000),
  registerGlobal: () => intFromEnv("RATE_REGISTER_GLOBAL", 600, 1, 1_000_000),
  searchPerUser: () => intFromEnv("RATE_SEARCH_USER", 60, 1, 100_000),
  departmentsPerIp: () => intFromEnv("RATE_DEPARTMENTS_IP", 120, 1, 100_000),
  uploadPerUser: () => intFromEnv("RATE_UPLOAD_USER", 60, 1, 10_000),
  uploadPerIp: () => intFromEnv("RATE_UPLOAD_IP", 20, 1, 10_000),
} as const;
