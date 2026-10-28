"use client";

import { useActionState, useState } from "react";
import { loginAction, verifyMfaAction } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, null);
  const [mfaState, mfaFormAction, mfaPending] = useActionState(verifyMfaAction, null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  const mfaStep = Boolean(loginState?.mfaRequired);

  if (mfaStep) {
    return (
      <form action={mfaFormAction} className="space-y-4">
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        {mfaState?.error ? (
          <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger)]">
            {mfaState.error}
          </div>
        ) : null}

        <div>
          <label htmlFor="code" className="label">
            {useRecoveryCode ? "Recovery Code" : "Authentication Code"}
          </label>
          <input
            id="code"
            name="code"
            type="text"
            required
            autoComplete="one-time-code"
            inputMode={useRecoveryCode ? "text" : "numeric"}
            placeholder={useRecoveryCode ? "Enter a recovery code" : "Enter the 6-digit code"}
            className="field"
            autoFocus
          />
        </div>

        <button
          type="submit"
          disabled={mfaPending}
          className={buttonClass("primary", "w-full")}
        >
          {mfaPending ? "Verifying…" : "Verify"}
        </button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setUseRecoveryCode((v) => !v)}
            className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--brand)] hover:underline"
          >
            {useRecoveryCode ? "Use authenticator app instead" : "Use a recovery code instead"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--brand)] hover:underline"
          >
            Start over
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action={loginFormAction} className="space-y-4">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      {loginState?.error ? (
        <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-xs font-medium text-[var(--danger)]">
          {loginState.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@university.edu"
          className="field"
        />
      </div>

      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          className="field"
        />
      </div>

      <button
        type="submit"
        disabled={loginPending}
        className={buttonClass("primary", "w-full")}
      >
        {loginPending ? (
          <>
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}

