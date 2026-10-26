/**
 * Retention cleanup for security data. Run periodically (cron / Vercel Cron):
 *   npm run purge
 *
 * - audit_logs older than AUDIT_RETENTION_DAYS (default 365)
 * - sessions revoked/expired longer than SESSION_RETENTION_DAYS (default 30)
 * - rate_limits rows older than 24h (their windows are long gone)
 * - visitor photos in Blob that no visitor row references (abandoned uploads,
 *   or photos of deleted visitors). Skipped when BLOB_READ_WRITE_TOKEN is unset.
 */
import "dotenv/config";
import { del, list } from "@vercel/blob";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { selectOrphanPhotos } from "../src/lib/photo-retention";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function daysFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isNaN(parsed) || parsed < 1 ? fallback : parsed;
}

async function main() {
  const auditDays = daysFromEnv("AUDIT_RETENTION_DAYS", 365);
  const sessionDays = daysFromEnv("SESSION_RETENTION_DAYS", 30);
  const visitDays = daysFromEnv("VISIT_RETENTION_DAYS", 365);
  const now = new Date();

  const auditCutoff = new Date(now.getTime() - auditDays * 86_400_000);
  const sessionCutoff = new Date(now.getTime() - sessionDays * 86_400_000);
  const visitCutoff = new Date(now.getTime() - visitDays * 86_400_000);
  const rateCutoff = new Date(now.getTime() - 86_400_000);

  const audit = await prisma.auditLog.deleteMany({ where: { createdAt: { lt: auditCutoff } } });
  const visits = await prisma.visit.deleteMany({
    where: {
      status: { in: ["CHECKED_OUT", "CANCELLED", "PENDING"] },
      updatedAt: { lt: visitCutoff },
    },
  });
  const visitors = await prisma.visitor.deleteMany({
    where: { updatedAt: { lt: visitCutoff }, visits: { none: {} } },
  });
  const sessions = await prisma.session.deleteMany({
    where: {
      OR: [
        { revokedAt: { not: null, lt: sessionCutoff } },
        { absoluteExpiresAt: { lt: sessionCutoff } },
      ],
    },
  });
  const rate = await prisma.rateLimit.deleteMany({ where: { windowStart: { lt: rateCutoff } } });
  const photosDeleted = await purgeOrphanPhotos(now);

  console.log(
    JSON.stringify({
      level: "info",
      event: "RETENTION_PURGE",
      auditDeleted: audit.count,
      visitsDeleted: visits.count,
      visitorsDeleted: visitors.count,
      sessionsDeleted: sessions.count,
      rateLimitsDeleted: rate.count,
      photosDeleted,
      auditDays,
      sessionDays,
      visitDays,
    })
  );
}

/** Removes Blob photos that no Visitor row points at. */
async function purgeOrphanPhotos(now: Date): Promise<number> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.log(JSON.stringify({ level: "info", event: "PHOTO_PURGE_SKIPPED", reason: "no_token" }));
    return 0;
  }

  const visitors = await prisma.visitor.findMany({ select: { photoUrl: true, idPhotoUrl: true } });
  const referenced = new Set<string>();
  for (const v of visitors) {
    if (v.photoUrl) referenced.add(v.photoUrl);
    if (v.idPhotoUrl) referenced.add(v.idPhotoUrl);
  }

  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "visitors/", cursor, limit: 1000 });
    const orphans = selectOrphanPhotos(page.blobs, referenced, now);
    if (orphans.length) {
      await del(orphans);
      deleted += orphans.length;
    }
    cursor = page.cursor;
  } while (cursor);

  return deleted;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ level: "error", event: "RETENTION_PURGE_ERROR", error: String(error) }));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
