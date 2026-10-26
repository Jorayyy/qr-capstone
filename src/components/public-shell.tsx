import Link from "next/link";
import { SITE } from "@/lib/site-info";
import { Building2, ClipboardList, Home, Mail, MapPin, Phone, ShieldCheck, MapPinned } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/#departments", label: "Departments", icon: Building2 },
  { href: "/#map", label: "Campus Map", icon: MapPinned },
  { href: "/#guidelines", label: "Visitor Guidelines", icon: ClipboardList },
] as const;

const NAV_ITEM =
  "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)]";

export const ACCENT_BUTTON =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-[var(--brand-strong)] shadow-sm transition hover:bg-[var(--accent-strong)]";

function Brand() {
  return (
    <Link href="/" className="flex min-w-0 items-center gap-3">
      <img src="/logo.png" alt={`${SITE.shortName} logo`} className="h-11 w-11 shrink-0 object-contain sm:h-12 sm:w-12" />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-extrabold uppercase leading-tight tracking-tight text-[var(--brand)] sm:text-[15px]">
          {SITE.university}
        </span>
        <span className="block truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
          {SITE.motto}
        </span>
      </span>
    </Link>
  );
}

function NavLinks({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Main">
      {NAV_LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={NAV_ITEM}>
          <link.icon className="h-4 w-4" />
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--paper)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-white/95 backdrop-blur print:hidden">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Brand />
          <NavLinks className="hidden items-center lg:flex" />
          <Link href="/register" className={`${ACCENT_BUTTON} shrink-0`}>
            <ShieldCheck className="h-4 w-4" />
            <span className="sm:hidden">Register</span>
            <span className="hidden sm:inline">Register as Visitor</span>
          </Link>
        </div>
        <div className="border-t border-[var(--border)] lg:hidden">
          <NavLinks className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-2 py-1.5 [scrollbar-width:none]" />
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer id="contact" className="bg-[var(--brand-strong)] text-white print:hidden">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-3">
          <div className="flex items-start gap-3">
            <img src="/logo.png" alt="" className="h-12 w-12 shrink-0 object-contain" />
            <div>
              <p className="text-sm font-extrabold uppercase leading-tight tracking-tight">{SITE.university}</p>
              <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-white/60">{SITE.motto}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm text-white/80">
            <p className="flex gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
              <span>{SITE.address}</span>
            </p>
            <p className="flex gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
              <span>{SITE.contactPhone}</span>
            </p>
            <p className="flex gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-white/50" />
              <span className="break-all">{SITE.contactEmail}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <Link href="/checkin" className="font-semibold text-white/85 hover:text-white">
              Self check-in / check-out
            </Link>
              <Link href="/#guidelines" className="font-semibold text-white/85 hover:text-white">
                Visitor guidelines
              </Link>
              <Link href="/privacy" className="font-semibold text-white/85 hover:text-white">
                Privacy notice
              </Link>
            <Link href="/login" className="font-semibold text-white/85 hover:text-white">
              Staff sign in
            </Link>
          </div>
        </div>
        <div className="border-t border-white/15 px-4 py-4 text-center text-xs text-white/55">
          {SITE.university} · Visitor Management System
        </div>
      </footer>
    </div>
  );
}
