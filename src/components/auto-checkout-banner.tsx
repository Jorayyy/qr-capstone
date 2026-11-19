"use client";

import { useState } from "react";
import { Card, cx } from "@/components/ui";
import { CalendarClock, X } from "lucide-react";

export function AutoCheckoutBanner({
  count,
  closedAt,
  className,
}: {
  count: number;
  closedAt: string | null;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <Card className={cx("border-[var(--warning)]/30 bg-[var(--warning-soft)]", className)}>
      <div className="flex items-start gap-3 p-4" role="status">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
        <p className="flex-1 text-sm text-[var(--foreground)]">
          <span className="font-semibold">
            {count} {count === 1 ? "visitor was" : "visitors were"} automatically checked out
          </span>{" "}
          after the office closing time{closedAt ? ` (${closedAt})` : ""}. Their exit was not scanned.
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss auto-checkout notice"
          className="-m-1 shrink-0 rounded-md p-1 text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
