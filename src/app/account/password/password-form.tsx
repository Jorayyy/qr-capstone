"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePasswordAction } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui";

export function PasswordForm({ mustChange }: { mustChange: boolean }) {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state?.success]);

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {mustChange && (
        <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-3 text-sm font-medium text-[var(--warning)]">
          You must set a new password before continuing.
        </div>
      )}
      {state?.error && (
        <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-lg border border-[var(--success)]/25 bg-[var(--success-soft)] px-4 py-3 text-sm font-medium text-[var(--success)]">
          Password updated. All other sessions were signed out.
        </div>
      )}

      <div>
        <label htmlFor="currentPassword" className="label">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="field"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="label">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className="field"
        />
        <p className="mt-1 text-xs text-[var(--muted)]">
          At least 12 characters, not similar to your name or email, and not a known breached
          password.
        </p>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "w-full py-3")}
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
