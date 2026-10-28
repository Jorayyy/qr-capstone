"use client";

import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

type Props = {
  children: React.ReactNode;
  userName?: string;
  userRole?: string;
};

/**
 * App shell: fixed sidebar on desktop, hamburger + slide-in drawer on phones.
 * The old shell always reserved 240 px for the sidebar, which left ~130 px of
 * usable width on a 375 px phone.
 */
export function AppShell({ children, userName, userRole }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer when the route changes (derived during render rather
  // than in an effect, so a back/forward navigation cannot leave it open).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)] print:block print:h-auto print:overflow-visible lg:flex-row">
      {/* Phone/tablet header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--accent)]/50 bg-[var(--brand-strong)] px-4 text-white print:hidden lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
        <img
          src="/logo.png"
          alt=""
          className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5"
        />
        <span className="truncate text-sm font-semibold tracking-tight">Visitor Management</span>
        {userRole ? (
          <span className="ml-auto rounded-md bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ring-1 ring-inset ring-white/15">
            {userRole}
          </span>
        ) : null}
      </header>

      {/* Desktop sidebar */}
      <div className="hidden shrink-0 print:hidden lg:block">
        <Sidebar userName={userName} userRole={userRole} />
      </div>

      {/* Phone/tablet drawer */}
      {open && (
        <div className="fixed inset-0 z-50 print:hidden lg:hidden">
          <div
            className="absolute inset-0 bg-[var(--foreground)]/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] shadow-[var(--shadow-pop)]"
            onClickCapture={(e) => {
              // Any navigation inside the drawer closes it.
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close navigation"
              className="absolute -right-12 top-3 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--muted)] shadow-xs ring-1 ring-black/5"
            >
              <X className="h-5 w-5" />
            </button>
            <Sidebar userName={userName} userRole={userRole} />
          </div>
        </div>
      )}

      <main className="min-w-0 flex-1 overflow-y-auto p-4 print:overflow-visible print:p-0 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
