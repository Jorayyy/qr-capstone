import { db } from "@/lib/db";
import { manilaParts } from "@/lib/ph-time";
import { formatReference } from "@/lib/registration";

/** Prisma's unique-constraint error, narrowed without importing its error classes. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/**
 * Next human-readable reference for the current year. The unique index stays
 * authoritative, so callers retry on P2002 instead of relying on this count.
 */
export async function nextReferenceCode(): Promise<string> {
  const year = manilaParts(new Date()).year;
  const count = await db.visit.count({
    where: { referenceCode: { startsWith: `EVSU-${year}-` } },
  });
  for (let offset = 1; offset <= 50; offset += 1) {
    const candidate = formatReference(year, count + offset);
    const taken = await db.visit.findUnique({
      where: { referenceCode: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  return formatReference(year, count + 51);
}
