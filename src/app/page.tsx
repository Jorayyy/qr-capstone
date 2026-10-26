import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { buttonClass } from "@/components/ui";
import { PublicShell, ACCENT_BUTTON } from "@/components/public-shell";
import {
  SITE,
  ABOUT,
  QUICK_LINKS,
  ENTRY_STEPS,
  ENTRY_REQUIREMENTS,
  PRIVACY_NOTICE,
} from "@/lib/site-info";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Landmark,
  LogIn,
  MapPin,
  QrCode,
  ShieldCheck,
  Users,
} from "lucide-react";

export const metadata: Metadata = {
  title: `Welcome · ${SITE.shortName} Visitor Management`,
  description:
    "Visitor entry, campus map, departments and visitor guidelines for Eastern Visayas State University.",
};

const SECTION = "scroll-mt-28 mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:py-20";

const EYEBROW =
  "text-[11px] font-bold uppercase tracking-[0.24em] text-[var(--brand)]/55";

const H2 = "mt-2 font-display text-3xl font-bold tracking-tight text-[var(--brand)] sm:text-4xl";

const BAND = "border-y border-[var(--brand)]/10 bg-white";

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function Home() {
  const user = await getSession();
  if (user) redirect("/dashboard");

  const departments = await db.department.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    take: 6,
    select: { id: true, name: true, building: true, photoPath: true },
  });

  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/bg.jpg')" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[var(--brand-strong)]/95 via-[var(--brand)]/85 to-[var(--brand-strong)]/55"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-px bg-[var(--accent)]/60"
        />

        <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--accent)]">
              Welcome to
            </p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              {SITE.university}
            </h1>
            <div className="mt-5 h-px w-16 bg-[var(--accent)]" />
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">
              A premier state university in Eastern Visayas, committed to academic excellence,
              innovation, and community development.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="#map" className={ACCENT_BUTTON}>
                Explore Our Campus
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/checkin"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/40 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
              >
                <QrCode className="h-4 w-4" />
                I have a pass
              </Link>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand)]">
              <Users className="h-7 w-7 text-white" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-[var(--brand)]">
              Visitor Registration
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              Pre-register online, scan your ID, and get your QR pass by email before you arrive.
            </p>
            <Link href="/register" className={buttonClass("primary", "mt-5 w-full py-3")}>
              Start Registration
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section id="map" className={SECTION}>
        <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr] lg:items-center">
          <div>
            <p className={EYEBROW}>Campus</p>
            <h2 className={H2}>Campus Map</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
              Find your destination easily. Explore the university buildings, departments, and
              offices — the Main Gate is where visitors enter and register.
            </p>
            <div className="mt-6 flex gap-3 border-t border-[var(--brand)]/10 pt-5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] font-display text-xs font-bold text-white">
                1
              </span>
              <p className="text-sm leading-relaxed text-[var(--foreground)]">
                <strong className="font-semibold">Main Gate</strong> — present your ID at the
                Front Desk to register and receive your QR pass.
              </p>
            </div>
            <a
              href={SITE.campusMap}
              target="_blank"
              rel="noreferrer"
              className={buttonClass("primary", "mt-6")}
            >
              <MapPin className="h-4 w-4" />
              View Full Map
            </a>
          </div>

          <a href={SITE.campusMap} target="_blank" rel="noreferrer" className="group block">
            <img
              src={SITE.campusMap}
              alt="EVSU campus map showing numbered buildings, roads and the main gate"
              className="w-full rounded-2xl border border-[var(--brand)]/10 bg-white shadow-sm transition group-hover:shadow-md"
            />
          </a>
        </div>
      </section>

      <div className={BAND}>
        <section id="departments" className={SECTION}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className={EYEBROW}>Directory</p>
              <h2 className={H2}>Our Departments &amp; Offices</h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                Explore our colleges, academic departments, and administrative offices.
              </p>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--brand)]/50">
              Ask the Front Desk for directions
            </p>
          </div>

          {departments.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--muted)]">
              The department directory is being updated. Please ask the Front Desk for assistance.
            </p>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <article
                  key={d.id}
                  className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm"
                >
                  <div className="relative h-36 bg-gradient-to-br from-[var(--brand)] to-[var(--brand-strong)]">
                    <div
                      aria-hidden
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: d.photoPath
                          ? `url('/api/department-photo?path=${encodeURIComponent(d.photoPath)}')`
                          : `url('/departments/${slugify(d.name)}.jpg')`,
                      }}
                    />
                    <Landmark
                      aria-hidden
                      className="absolute right-4 top-4 h-8 w-8 text-white/25"
                    />
                  </div>
                  <div className="relative px-5 pb-5">
                    <span className="-mt-5 mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow ring-1 ring-[var(--border)]">
                      <Landmark className="h-5 w-5 text-[var(--brand)]" />
                    </span>
                    <h3 className="text-sm font-bold leading-snug tracking-tight">{d.name}</h3>
                    {d.building ? (
                      <p className="mt-1 text-xs uppercase tracking-[0.08em] text-[var(--muted)]">
                        {d.building}
                      </p>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section id="steps" className={SECTION}>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <p className={EYEBROW}>Registration</p>
            <h2 className={H2}>How to enter</h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-[var(--muted)]">
              Pre-register online for a QR pass, or register at the Front Desk when you arrive.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/register" className={buttonClass("primary")}>
                Register as a visitor
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/checkin" className={buttonClass("secondary")}>
                <LogIn className="h-4 w-4" />
                I already have a pass
              </Link>
            </div>
          </div>

          <div className="relative">
            <div
              aria-hidden
              className="absolute bottom-6 left-5 top-6 w-px bg-[var(--brand)]/15"
            />
            <ol className="space-y-9">
              {ENTRY_STEPS.map((step, i) => (
                <li key={step.title} className="relative pl-14">
                  <span className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--brand)]/25 bg-[var(--paper)] font-display text-sm font-bold text-[var(--brand)]">
                    {i + 1}
                  </span>
                  <h3 className="pt-1.5 text-base font-bold tracking-tight">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <div className={BAND}>
        <div className={SECTION}>
          <div className="grid gap-8 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-[var(--brand)]/10">
            <section className="lg:pr-8">
              <p className={EYEBROW}>The University</p>
              <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-[var(--brand)]">
                About EVSU
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{ABOUT}</p>
              <a
                href="https://evsu.edu.ph"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand)] hover:underline"
              >
                Learn More About Us
                <ArrowRight className="h-4 w-4" />
              </a>
            </section>

            <section id="guidelines" className="scroll-mt-28 lg:px-8">
              <p className={EYEBROW}>Before you visit</p>
              <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-[var(--brand)]">
                Visitor Guidelines
              </h2>
              <ul className="mt-3 space-y-2.5">
                {ENTRY_REQUIREMENTS.map((req) => (
                  <li key={req} className="flex gap-2.5 text-sm text-[var(--muted)]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]/70" />
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="lg:px-8">
              <p className={EYEBROW}>Shortcuts</p>
              <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-[var(--brand)]">
                Quick Links
              </h2>
              <ul className="mt-3 space-y-2.5">
                {QUICK_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      {...(link.href.startsWith("http")
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--foreground)] hover:text-[var(--brand)] hover:underline"
                    >
                      {link.label}
                      <ArrowUpRight className="h-3.5 w-3.5 text-[var(--muted)]" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>

            <section className="relative isolate flex min-h-52 items-end overflow-hidden rounded-2xl p-6 lg:ml-8">
              <div
                aria-hidden
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('/bg.jpg')" }}
              />
              <div aria-hidden className="absolute inset-0 bg-[var(--brand-strong)]/75" />
              <blockquote className="relative font-display text-base italic leading-relaxed text-white">
                “Together, we build a brighter future.”
                <footer className="mt-2 font-sans text-[11px] not-italic uppercase tracking-[0.14em] text-white/70">
                  {SITE.university}
                </footer>
              </blockquote>
            </section>
          </div>
        </div>
      </div>

      <section className={SECTION}>
        <div className="grid gap-10 md:grid-cols-2 md:gap-0 md:divide-x md:divide-[var(--brand)]/10">
          <section className="md:pr-10">
            <p className={EYEBROW}>Front Desk</p>
            <h2 className="mt-2 font-display text-xl font-bold tracking-tight text-[var(--brand)]">
              Office hours
            </h2>
            <ul className="mt-4 space-y-2.5">
              {SITE.officeHours.map((h) => (
                <li
                  key={h.days}
                  className="flex items-center justify-between gap-3 border-b border-[var(--brand)]/10 pb-2.5 text-sm last:border-0"
                >
                  <span className="text-[var(--muted)]">{h.days}</span>
                  <span className="font-semibold tabular-nums">{h.hours}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="md:pl-10">
            <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight text-[var(--brand)]">
              <ShieldCheck className="h-5 w-5" />
              Privacy notice
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{PRIVACY_NOTICE}</p>
          </section>
        </div>

        <div className="mt-12 flex flex-col items-center gap-4 border-t border-[var(--brand)]/10 pt-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-display text-xl font-bold tracking-tight text-[var(--brand)]">
              Ready to check in?
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Scan your pass at the entrance, or self check-in with your pass code.
            </p>
          </div>
          <Link href="/checkin" className={buttonClass("primary", "shrink-0")}>
            <LogIn className="h-4 w-4" />
            Check in / out
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
