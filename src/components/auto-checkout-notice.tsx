import { Card, cx } from "@/components/ui";
import { getRecentAutoCheckouts } from "@/lib/auto-checkout";
import { PH_TZ } from "@/lib/ph-time";
import { CalendarClock } from "lucide-react";

/** Shows auto-checkouts from the last 24 hours. Pair with autoCheckOutOverdueVisits(). */
export async function AutoCheckoutNotice({ className }: { className?: string }) {
  const { count, cutoff } = await getRecentAutoCheckouts();
  if (count === 0) return null;

  const closedAt = cutoff
    ? new Date(cutoff).toLocaleString("en-PH", {
        timeZone: PH_TZ,
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  return (
    <Card className={cx("border-[var(--warning)]/30 bg-[var(--warning-soft)]", className)}>
      <div className="flex items-start gap-3 p-4" role="status">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
        <p className="text-sm text-[var(--foreground)]">
          <span className="font-semibold">
            {count} {count === 1 ? "visitor was" : "visitors were"} automatically checked out
          </span>{" "}
          after the office closing time{closedAt ? ` (${closedAt})` : ""}. Their exit was not scanned.
        </p>
      </div>
    </Card>
  );
}
