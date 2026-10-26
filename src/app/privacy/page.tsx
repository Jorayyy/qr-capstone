import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import { buttonClass } from "@/components/ui";
import { PRIVACY_EFFECTIVE, PRIVACY_SECTIONS, SITE } from "@/lib/site-info";

export const metadata: Metadata = {
  title: `Privacy Notice · ${SITE.shortName} Visitor Management`,
  description:
    "How EVSU collects, uses, shares, and keeps visitor personal data, and how to exercise your rights under the Data Privacy Act of 2012.",
};

export default function PrivacyPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
          Data Privacy Act of 2012 · RA 10173
        </p>
        <h1 className="mt-2 flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-[var(--brand)]">
          <ShieldCheck className="h-7 w-7" />
          Privacy Notice
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Effective {PRIVACY_EFFECTIVE} · Version 1.0 · Applies to all campus visitors
        </p>

        <p className="mt-6 text-sm leading-relaxed">
          This notice explains what personal data EVSU collects when you register as a visitor,
          why we collect it, who sees it, how long we keep it, and the rights you have under the
          Data Privacy Act of 2012, its Implementing Rules and Regulations, National Privacy
          Commission issuances, and applicable CHED policies.
        </p>

        <div className="mt-8 space-y-6">
          {PRIVACY_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-display text-lg font-bold text-[var(--brand)]">{section.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--brand-soft)]/40 p-5 text-sm">
          <h2 className="font-semibold text-[var(--brand)]">Contact the Data Protection Officer</h2>
          <p className="mt-1 text-[var(--muted)]">
            {SITE.university} · {SITE.address}
            <br />
            Email{" "}
            <a className="font-semibold text-[var(--brand)] hover:underline" href={`mailto:${SITE.dpoEmail}`}>
              {SITE.dpoEmail}
            </a>{" "}
            · Phone {SITE.contactPhone}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            You may also file a complaint with the National Privacy Commission at{" "}
            <a
              className="font-semibold text-[var(--brand)] hover:underline"
              href="https://complaints.privacy.gov.ph"
              target="_blank"
              rel="noreferrer"
            >
              complaints.privacy.gov.ph
            </a>
            .
          </p>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className={buttonClass("primary")}>
            Continue to registration
          </Link>
          <Link href="/" className={buttonClass("secondary")}>
            Back to homepage
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
