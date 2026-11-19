"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { updateCampusClosingAction, type DepartmentActionState } from "@/lib/actions/departments";

export function CampusClosingForm({ initialTime }: { initialTime: string }) {
  const [state, formAction, pending] = useActionState<DepartmentActionState, FormData>(
    updateCampusClosingAction,
    { success: false, message: "" }
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1">
          <label className="label" htmlFor="campus-closing">
            Closing time
          </label>
          <Input
            id="campus-closing"
            name="closingTime"
            type="time"
            required
            defaultValue={initialTime}
          />
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
      {state.message ? (
        <p className={state.success ? "text-xs text-[var(--success)]" : "text-xs text-[var(--danger)]"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
