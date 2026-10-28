import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import { SITE } from "@/lib/site-info";
import { ArrowLeft, ScanLine } from "lucide-react";
import CheckinForm from "./checkin-form";

export const metadata = {
  title: `Self check-in · ${SITE.shortName} Visitor System`,
  description: "Check yourself in or out using your visitor pass and ID number.",
};

export default function CheckinPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-md px-4 py-12 sm:px-6">
        <span className="inline-flex items-center gap-2 rounded-md bg-[var(--brand-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand)]">
          <ScanLine className="h-3.5 w-3.5" />
          Self check-in
        </span>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[var(--brand)]">Check in or out</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          Scan your pass or type the pass code, then enter the ID number you presented at the
          Front Desk. Staff can help if you need assistance.
        </p>

        <div className="mt-6">
          <CheckinForm />
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] underline-offset-2 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            New visitor? See how to enter
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
