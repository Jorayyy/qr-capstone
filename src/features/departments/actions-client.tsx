"use client";

import { useActionState } from "react";
import { toggleDepartmentAction, deleteDepartmentAction } from "@/lib/actions/departments";
import { iconActionClass } from "@/components/ui";
import { ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

export function ToggleForm({ departmentId, isActive }: { departmentId: string; isActive: boolean }) {
  const [state, formAction, pending] = useActionState(
    () => toggleDepartmentAction(departmentId),
    { success: false, message: "" }
  );

  const label = isActive ? "Deactivate department" : "Activate department";

  return (
    <form action={formAction} className="inline-flex flex-col">
      <button
        type="submit"
        disabled={pending}
        className={iconActionClass(isActive ? "amber" : "emerald")}
        title={label}
        aria-label={label}
      >
        {isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      </button>
      {state.message && !state.success && (
        <p className="mt-1 text-[10px] text-[var(--danger)]">{state.message}</p>
      )}
    </form>
  );
}

export function DeleteForm({
  departmentId,
  visitCount,
  stopCount,
}: {
  departmentId: string;
  visitCount: number;
  stopCount: number;
}) {
  const [state, formAction, pending] = useActionState(
    () => deleteDepartmentAction(departmentId),
    { success: false, message: "" }
  );

  const canDelete = visitCount === 0 && stopCount === 0;

  return (
    <form action={formAction} className="inline-flex flex-col">
      {/* The wrapper carries the tooltip — a disabled button ignores pointer events. */}
      <span
        className="inline-flex"
        title={canDelete ? "Delete department" : "Cannot delete — this office already has visits or stops"}
      >
        <button
          type="submit"
          disabled={pending || !canDelete}
          className={iconActionClass("red")}
          aria-label="Delete department"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </span>
      {state.message && !state.success && (
        <p className="mt-1 text-[10px] text-[var(--danger)]">{state.message}</p>
      )}
    </form>
  );
}
