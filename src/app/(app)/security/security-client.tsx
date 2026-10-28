"use client";

import { useActionState, useState, type FormEvent, type ReactNode } from "react";
import type { AdminUserState } from "@/lib/actions/admin";
import { buttonClass } from "@/components/ui";

/** Small form button that runs a state-returning admin server action. */
export function RowAction({
  action,
  fields,
  children,
  variant = "secondary",
  confirmText,
  inline = false,
}: {
  action: (prev: AdminUserState, formData: FormData) => Promise<AdminUserState>;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "secondary" | "danger";
  confirmText?: string;
  inline?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [dismissed, setDismissed] = useState(false);

  const visible = Boolean((state?.error || state?.success || state?.tempPassword) && !dismissed);

  return (
    <div className={inline ? "inline-block" : "block"}>
      <form
        action={formAction}
        onSubmit={(e: FormEvent) => {
          if (confirmText && !window.confirm(confirmText)) {
            e.preventDefault();
            return;
          }
        }}
      >
        {Object.entries(fields).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <button
          type="submit"
          disabled={pending}
          className={
            variant === "danger"
              ? "rounded-lg border border-[var(--danger)]/20 bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--danger)] transition-colors hover:bg-[var(--danger-soft)] disabled:opacity-50"
              : "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50"
          }
        >
          {pending ? "…" : children}
        </button>
      </form>
      {visible && (
        <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
          {state?.error && <p className="font-medium text-[var(--danger)]">{state.error}</p>}
          {state?.success && <p className="font-medium text-[var(--success)]">{state.success}</p>}
          {state?.tempPassword && (
            <div className="mt-2">
              <p className="font-semibold text-[var(--foreground)]">One-time password — copy now:</p>
              <code className="mt-1 block break-all rounded-md bg-[var(--surface)] px-2 py-1 font-mono text-[13px] text-[var(--foreground)]">
                {state.tempPassword}
              </code>
            </div>
          )}
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="mt-2 text-[var(--muted)] underline hover:text-[var(--foreground)]"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

/** Per-row role selector (ADMIN only, never on your own account). */
export function RoleSelect({
  action,
  userId,
  currentRole,
  roles,
  disabled,
}: {
  action: (prev: AdminUserState, formData: FormData) => Promise<AdminUserState>;
  userId: string;
  currentRole: string;
  roles: readonly string[];
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="inline-flex items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={currentRole}
        disabled={disabled || pending}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs focus:border-[var(--brand)] focus:outline-none disabled:opacity-50"
      >
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] disabled:opacity-50"
      >
        {pending ? "…" : "Set"}
      </button>
      {state?.error && <span className="text-xs text-[var(--danger)]">{state.error}</span>}
      {state?.success && <span className="text-xs text-[var(--success)]">{state.success}</span>}
    </form>
  );
}

/** Admin create-user form with one-time password display. */
export function CreateUserForm({
  action,
  roles,
}: {
  action: (prev: AdminUserState, formData: FormData) => Promise<AdminUserState>;
  roles: readonly string[];
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [dismissed, setDismissed] = useState(false);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
      <p className="text-sm font-semibold">Create staff account</p>
      {state?.error && !dismissed && (
        <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger)]">
          {state.error}
        </div>
      )}
      {state?.success && !dismissed && (
        <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success-soft)] px-3 py-2 text-xs text-[var(--success)]">
          <p className="font-medium">{state.success}</p>
          {state.tempPassword && (
            <code className="mt-1 block break-all rounded-md bg-[var(--surface)] px-2 py-1 font-mono text-[13px]">
              {state.tempPassword}
            </code>
          )}
          <button type="button" onClick={() => setDismissed(true)} className="mt-1 underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          name="email"
          type="email"
          required
          placeholder="email@university.edu"
          className="field"
        />
        <input
          name="name"
          type="text"
          required
          maxLength={120}
          placeholder="Full name"
          className="field"
        />
        <select
          name="role"
          defaultValue="STAFF"
          className="field"
        >
          {roles.map((role) => (
            <option key={role} value={role}>
              {role}
            </option>
          ))}
        </select>
      </div>
      <input
        name="password"
        type="text"
        maxLength={128}
        placeholder="Initial password (leave blank to auto-generate)"
        className="w-full field"
      />
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary")}
      >
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
