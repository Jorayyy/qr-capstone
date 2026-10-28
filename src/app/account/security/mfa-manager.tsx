"use client";

import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  disableMfaAction,
  regenerateRecoveryCodesAction,
  startMfaEnrollmentAction,
  verifyMfaEnrollmentAction,
} from "@/lib/actions/mfa";
import { buttonClass } from "@/components/ui";

type Props = {
  email: string;
  mfaEnabled: boolean;
};

export function MfaManager({ email, mfaEnabled }: Props) {
  if (mfaEnabled) return <MfaEnabled email={email} />;
  return <MfaSetup email={email} />;
}

function MfaSetup({ email }: { email: string }) {
  const [uri, setUri] = useState<string | null>(null);
  const [manualSecret, setManualSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  const [verifyState, verifyAction, verifying] = useActionState(verifyMfaEnrollmentAction, null);

  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    QRCode.toDataURL(uri, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);

  async function handleStart() {
    setStarting(true);
    setSetupError(null);
    try {
      const result = await startMfaEnrollmentAction();
      if (result?.error) {
        setSetupError(result.error);
      } else if (result?.uri) {
        setUri(result.uri);
        setManualSecret(result.secret ?? null);
      }
    } finally {
      setStarting(false);
    }
  }

  if (verifyState?.recoveryCodes) {
    return <RecoveryCodes codes={verifyState.recoveryCodes} done={false} />;
  }

  if (!uri) {
    return (
      <div className="space-y-4">
        {setupError && (
          <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
            {setupError}
          </div>
        )}
        <p className="text-sm text-[var(--muted)]">
          Scan a QR code with your authenticator app, then enter the 6-digit code it shows to
          confirm. You will get one-time recovery codes to use if you lose access to the app.
        </p>
        <button
          type="button"
          onClick={handleStart}
          disabled={starting}
          className={buttonClass("primary", "px-4 py-3")}
        >
          {starting ? "Preparing…" : "Set up authenticator app"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Authenticator QR code" width={220} height={220} />
          ) : (
            <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-[var(--muted)]">
              Loading QR…
            </div>
          )}
        </div>
        <div className="text-sm text-[var(--muted)] space-y-2">
          <p>Can&apos;t scan? Enter this key manually in your app:</p>
          <code className="block break-all rounded-md bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--foreground)]">
            {manualSecret}
          </code>
          <p>Account: <span className="font-medium text-[var(--foreground)]">{email}</span></p>
        </div>
      </div>

      <form action={verifyAction} className="space-y-3">
        {verifyState?.error && (
          <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
            {verifyState.error}
          </div>
        )}
        <div>
          <label htmlFor="mfa-code" className="label">
            6-digit code
          </label>
          <input
            id="mfa-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            maxLength={10}
            placeholder="000000"
            className="field max-w-xs"
          />
        </div>
        <button
          type="submit"
          disabled={verifying}
          className={buttonClass("primary", "px-4 py-3")}
        >
          {verifying ? "Verifying…" : "Verify and enable"}
        </button>
      </form>
    </div>
  );
}

function MfaEnabled({ email }: { email: string }) {
  const [regenState, regenAction, regenerating] = useActionState(regenerateRecoveryCodesAction, null);
  const [disableState, disableAction, disabling] = useActionState(disableMfaAction, null);
  const [showRegen, setShowRegen] = useState(false);

  if (regenState?.recoveryCodes) {
    return <RecoveryCodes codes={regenState.recoveryCodes} done={true} onBack={() => setShowRegen(false)} />;
  }

  if (disableState?.success) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-3 text-sm font-medium text-[var(--warning)]">
          Two-factor authentication is now off. Consider setting it up again soon.
        </div>
        <MfaManager email={email} mfaEnabled={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--success)]" />
        Two-factor authentication is enabled
      </div>

      {!showRegen ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setShowRegen(true)}
            className={buttonClass("secondary")}
          >
            Regenerate recovery codes
          </button>
        </div>
      ) : (
        <form action={regenAction} className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4">
          {regenState?.error && (
            <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
              {regenState.error}
            </div>
          )}
          <p className="text-sm text-[var(--muted)]">
            This invalidates your current recovery codes and issues a new set.
          </p>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Confirm with your password"
            className="field max-w-sm"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={regenerating}
              className={buttonClass("primary")}
            >
              {regenerating ? "Generating…" : "Generate new codes"}
            </button>
            <button
              type="button"
              onClick={() => setShowRegen(false)}
              className={buttonClass("secondary")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)]/60 p-4">
        <p className="text-sm font-semibold text-[var(--danger)]">Turn off two-factor authentication</p>
        <form action={disableAction} className="mt-3 space-y-3">
          {disableState?.error && (
            <div className="rounded-lg border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-4 py-3 text-sm font-medium text-[var(--danger)]">
              {disableState.error}
            </div>
          )}
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="Confirm with your password"
            className="field max-w-sm"
          />
          <button
            type="submit"
            disabled={disabling}
            className={buttonClass("danger")}
          >
            {disabling ? "Disabling…" : "Disable MFA"}
          </button>
        </form>
      </div>
    </div>
  );
}

function RecoveryCodes({
  codes,
  done,
  onBack,
}: {
  codes: string[];
  done: boolean;
  onBack?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--warning)]/25 bg-[var(--warning-soft)] px-4 py-3 text-sm font-medium text-[var(--warning)]">
        {done
          ? "New recovery codes generated — the old set no longer works."
          : "Two-factor authentication is now enabled."}{" "}
        Save these somewhere safe. They are shown only once.
      </div>
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 font-mono text-sm sm:grid-cols-3">
        {codes.map((code) => (
          <span key={code} className="tracking-wider">
            {code}
          </span>
        ))}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className={buttonClass("secondary")}
        >
          Print codes
        </button>
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className={buttonClass("primary")}
          >
            Done
          </button>
        ) : (
          <a
            href="/dashboard"
            className={buttonClass("primary")}
          >
            Continue to dashboard
          </a>
        )}
      </div>
    </div>
  );
}
