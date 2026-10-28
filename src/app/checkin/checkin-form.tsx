"use client";

import { useState } from "react";
import { buttonClass } from "@/components/ui";
import { CameraViewport } from "@/components/camera-viewport";
import { LogIn, LogOut, ScanLine } from "lucide-react";

const CARD = "rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-xs";
const LABEL = "label";
const INPUT = "field";

type Result = { action: "CHECKED_IN" | "CHECKED_OUT"; visitorName: string; departmentName: string; at: string };

export default function CheckinForm() {
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/visits/self-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr: qr.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Check-in failed.");
      setResult(data as Result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const checkedIn = result.action === "CHECKED_IN";
    return (
      <div className={`${CARD} p-8 text-center`}>
        <div className="mb-4 flex justify-center">
          <div className="rounded-xl bg-[var(--success-soft)] p-3">
            {checkedIn ? (
              <LogIn className="h-7 w-7 text-[var(--success)]" />
            ) : (
              <LogOut className="h-7 w-7 text-[var(--success)]" />
            )}
          </div>
        </div>
        <h2 className="text-xl font-semibold tracking-tight">
          {checkedIn ? "You are checked in" : "You are checked out"}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Welcome, {result.visitorName}. Your {checkedIn ? "arrival at" : "exit from"}{" "}
          {result.departmentName} is recorded.
        </p>
        <p className="mt-3 text-xs text-[var(--muted)]">
          {new Date(result.at).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <button
          type="button"
          className={buttonClass("secondary", "mt-6")}
          onClick={() => {
            setResult(null);
            setQr("");
          }}
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={`${CARD} space-y-5 p-6`}>
      {error && (
        <div className="rounded-lg border border-[var(--danger)]/20 bg-[var(--danger-soft)] px-3 py-2 text-sm font-medium text-[var(--danger)]">
          {error}
        </div>
      )}

      <div>
        <label className={LABEL} htmlFor="pass-code">
          Pass code
        </label>
        <div className="flex gap-2">
          <input
            id="pass-code"
            value={qr}
            onChange={(e) => setQr(e.target.value.toUpperCase())}
            placeholder="e.g. VMS-3F2A…"
            autoComplete="off"
            required
            className={`${INPUT} font-mono`}
          />
          <button
            type="button"
            onClick={() => setScanning((v) => !v)}
            className={buttonClass("secondary", "shrink-0")}
            aria-label={scanning ? "Stop scanning" : "Scan your pass QR code"}
          >
            <ScanLine className="h-4 w-4" />
            {scanning ? "Stop" : "Scan"}
          </button>
        </div>
        {scanning && (
          <div className="mt-3">
            <CameraViewport
              active={scanning}
              onScan={(text) => {
                setQr(text.trim().toUpperCase());
                setScanning(false);
              }}
              className="rounded-lg"
            />
            <p className="mt-2 text-xs text-[var(--muted)]">Point the camera at the QR code on your pass.</p>
          </div>
        )}
        <p className="mt-1 text-xs text-[var(--muted)]">The code printed on your visitor pass.</p>
      </div>

      <button
        type="submit"
        disabled={busy}
        className={buttonClass("primary", "w-full")}
      >
        {busy ? "Checking…" : "Check in / out"}
      </button>
    </form>
  );
}

