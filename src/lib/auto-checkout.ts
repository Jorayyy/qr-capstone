import { db } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import {
  CAMPUS_CLOSING_KEY,
  DEFAULT_CLOSING_MINUTE,
  nextClosingAt,
  safeClosingMinute,
} from "@/lib/closing-time";

/** Reads the campus-wide closing time, creating the default row on first use. */
export async function getCampusClosingMinute(): Promise<number> {
  const setting = await db.setting.upsert({
    where: { key: CAMPUS_CLOSING_KEY },
    update: {},
    create: { key: CAMPUS_CLOSING_KEY, value: String(DEFAULT_CLOSING_MINUTE) },
  });
  return safeClosingMinute(Number(setting.value));
}

/**
 * Closes visits that overstayed their office's closing time.
 * Runs on dashboard loads (no cron); updates are idempotent so repeat runs are safe.
 */
export async function autoCheckOutOverdueVisits(): Promise<number> {
  try {
    const campusMinute = await getCampusClosingMinute();
    const visits = await db.visit.findMany({
      where: { status: "CHECKED_IN" },
      select: {
        id: true,
        actualArrival: true,
        createdAt: true,
        department: { select: { closingMinute: true } },
        stops: {
          where: { checkedInAt: { not: null } },
          select: {
            id: true,
            checkedInAt: true,
            checkedOutAt: true,
            department: { select: { closingMinute: true } },
          },
        },
      },
    });

    const now = Date.now();
    let closedCount = 0;

    for (const visit of visits) {
      const closingFor = (minute: number | null, from: Date) =>
        nextClosingAt(safeClosingMinute(minute ?? campusMinute), from);
      const arrival = visit.actualArrival ?? visit.createdAt;

      const stopCloses = visit.stops.map((stop) => ({
        id: stop.id,
        alreadyOut: stop.checkedOutAt !== null,
        cutoff: closingFor(stop.department.closingMinute, stop.checkedInAt!),
      }));
      const visitCutoff = stopCloses.reduce(
        (latest, stop) => (stop.cutoff.getTime() > latest.getTime() ? stop.cutoff : latest),
        closingFor(visit.department.closingMinute, arrival)
      );

      for (const stop of stopCloses) {
        if (stop.alreadyOut || now < stop.cutoff.getTime()) continue;
        await db.visitStop.updateMany({
          where: { id: stop.id, checkedOutAt: null },
          data: { checkedOutAt: stop.cutoff },
        });
      }

      if (now < visitCutoff.getTime()) continue;

      const updated = await db.visit.updateMany({
        where: { id: visit.id, status: "CHECKED_IN" },
        data: {
          status: "CHECKED_OUT",
          actualDeparture: visitCutoff,
          checkedOutById: null,
        },
      });
      if (updated.count === 0) continue;

      closedCount += 1;
      await recordAudit({
        action: "VISIT_AUTO_CHECKED_OUT",
        result: "SUCCESS",
        targetType: "visit",
        targetId: visit.id,
        meta: { cutoff: visitCutoff.toISOString(), reason: "campus_closed" },
      });
    }

    return closedCount;
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "AUTO_CHECKOUT_ERROR",
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return 0;
  }
}

/** Audit rows for the dashboard notice; keep the clock reads out of components. */
export async function getRecentAutoCheckouts(hours = 24): Promise<{ count: number; cutoff: string | null }> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db.auditLog.findMany({
    where: { action: "VISIT_AUTO_CHECKED_OUT", result: "SUCCESS", createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    select: { meta: true },
  });
  const cutoff =
    rows
      .map((row) => (row.meta as { cutoff?: unknown } | null)?.cutoff)
      .find((value): value is string => typeof value === "string") ?? null;
  return { count: rows.length, cutoff };
}
