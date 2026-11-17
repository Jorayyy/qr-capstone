"use client";

import { useState, useTransition } from "react";
import { setDepartmentStatusAction } from "@/lib/actions/departments";
import { cx } from "@/components/ui";
import { DoorClosed, DoorOpen, UserCheck, UserX } from "lucide-react";

const chip =
  "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ring-black/5 transition-colors disabled:pointer-events-none disabled:opacity-50";

/** Staff/admin toggles that notify the system the office is open/closed and the head is in/out. */
export function OfficeStatusControl({
  departmentId,
  officeOpen,
  headInOffice,
}: {
  departmentId: string;
  officeOpen: boolean;
  headInOffice: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function update(open: boolean, head: boolean) {
    setMessage("");
    startTransition(async () => {
      const res = await setDepartmentStatusAction(departmentId, open, head);
      setMessage(res.message);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => update(!officeOpen, headInOffice)}
        className={cx(
          chip,
          officeOpen
            ? "bg-[var(--success-soft)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white"
            : "bg-[var(--danger-soft)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white"
        )}
        title={officeOpen ? "Mark office closed" : "Mark office open"}
      >
        {officeOpen ? <DoorOpen className="h-3.5 w-3.5" /> : <DoorClosed className="h-3.5 w-3.5" />}
        {officeOpen ? "Office open" : "Office closed"}
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => update(officeOpen, !headInOffice)}
        className={cx(
          chip,
          headInOffice
            ? "bg-[var(--success-soft)] text-[var(--success)] hover:bg-[var(--success)] hover:text-white"
            : "bg-[var(--warning-soft)] text-[var(--warning)] hover:bg-[var(--warning)] hover:text-white"
        )}
        title={headInOffice ? "Mark head of office out" : "Mark head of office in"}
      >
        {headInOffice ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
        {headInOffice ? "Head in" : "Head out"}
      </button>

      {message && <span className="text-[11px] text-[var(--muted)]">{message}</span>}
    </div>
  );
}
