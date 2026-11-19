import { AutoCheckoutBanner } from "@/components/auto-checkout-banner";
import { getRecentAutoCheckouts } from "@/lib/auto-checkout";
import { PH_TZ } from "@/lib/ph-time";

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

  return <AutoCheckoutBanner count={count} closedAt={closedAt} className={className} />;
}
