import { SITE } from "@/lib/site-info";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] bg-[var(--paper)] lg:grid-cols-2">
      <div className="relative isolate flex min-h-44 flex-col justify-end overflow-hidden px-6 py-8 sm:px-10 lg:min-h-0 lg:justify-between lg:py-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/bg.jpg')" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[var(--brand-strong)]/95 via-[var(--brand)]/80 to-[var(--brand-strong)]/30"
        />

        <div className="relative flex items-center gap-3">
          <img src="/logo.png" alt={`${SITE.shortName} logo`} className="h-11 w-11 object-contain" />
          <div>
            <p className="font-display text-base font-semibold leading-tight tracking-tight text-white sm:text-lg">
              {SITE.university}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
              {SITE.motto}
            </p>
          </div>
        </div>

        <div className="relative mt-6 hidden lg:mt-0 lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--accent)]">
            Visitor Management
          </p>
          <p className="mt-3 max-w-md font-display text-4xl font-semibold leading-tight tracking-tight text-white">
            Secure, QR-based campus entry.
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/70">
            Register at the Front Desk, receive your pass, and scan in and out at the gate.
          </p>
        </div>

        <p className="relative mt-6 hidden text-[11px] text-white/45 lg:block">
          {SITE.university} · {new Date().getFullYear()}
        </p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-6 lg:py-16">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
