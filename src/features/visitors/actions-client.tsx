"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  cancelVisitAction,
  checkInAction,
  deleteVisitorAction,
  type VisitActionState,
} from "@/lib/actions/visitors";
import { LogIn, Ban, ScanLine } from "lucide-react";

type VisitStatus = "PENDING" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

/**
 * Manual check-in for the visitor profile. Check-out is deliberately absent:
 * exits are recorded only by scanning the visitor's QR pass at the scanner.
 * Server enforces the state machine.
 */
export function VisitControls({
  visitId,
  status,
}: {
  visitId: string;
  status: VisitStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function run(action: () => Promise<VisitActionState>, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      setMessage({ ok: res.success, text: res.message });
      if (res.success) router.refresh();
    });
  }

  if (status === "CHECKED_OUT" || status === "CANCELLED") {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <Button
          disabled={pending}
          onClick={() => run(() => checkInAction(visitId))}
        >
          <LogIn className="h-3.5 w-3.5" />
          {pending ? "Working..." : "Mark as Arrived"}
        </Button>
      )}

      {status === "CHECKED_IN" && (
        <p className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <ScanLine className="h-3.5 w-3.5" />
          Check-out is recorded by scanning this visitor&apos;s QR pass.
        </p>
      )}

      <Button
        variant="ghost"
        disabled={pending}
        className="text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
        onClick={() =>
          run(() => cancelVisitAction(visitId), "Cancel this visit? The QR code will stop working.")
        }
      >
        <Ban className="h-3.5 w-3.5" />
        Cancel Visit
      </Button>

      {message && (
        <span
          className={
            message.ok
              ? "text-xs font-medium text-[var(--success)]"
              : "text-xs font-medium text-[var(--danger)]"
          }
        >
          {message.text}
        </span>
      )}
    </div>
  );
}

export function DeleteVisitorButton({ visitorId }: { visitorId: string }) {
  const [state, formAction, pending] = useActionState(
    () => deleteVisitorAction(visitorId),
    { success: false, message: "" }
  );

  return (
    <form action={formAction} className="inline">
      <Button
        type="submit"
        variant="ghost"
        disabled={pending}
        className="text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]"
        onClick={(e) => {
          if (!confirm("Delete this visitor and all their visits?")) {
            e.preventDefault();
          }
        }}
      >
        {pending ? "Deleting..." : "Delete"}
      </Button>
      {state.message && !state.success && (
        <p className="mt-1 text-[10px] text-[var(--danger)]">{state.message}</p>
      )}
    </form>
  );
}
