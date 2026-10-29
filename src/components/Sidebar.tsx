"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  LogOut,
  ScanLine,
  Building2,
  ShieldCheck,
  FileBarChart,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { cx, buttonClass, Avatar } from "@/components/ui";
import { logoutAction } from "@/lib/actions/auth";
import { PORTAL_LABELS, type Portal } from "@/lib/portal";

type NavItem = { href: string; label: string; icon: LucideIcon; exclude?: string[]; exact?: boolean };

const NAV_ITEMS: Record<Portal, NavItem[]> = {
  admin: [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/visitors", label: "Visitors", icon: Users, exclude: ["/admin/visitors/register"] },
    { href: "/admin/visitors/register", label: "Register Walk-in", icon: UserPlus },
    { href: "/admin/scanner", label: "Scan QR", icon: ScanLine },
    { href: "/admin/departments", label: "Departments", icon: Building2 },
    { href: "/admin/reports", label: "Reports", icon: FileBarChart },
    { href: "/admin/security", label: "Security", icon: ShieldCheck },
  ],
  staff: [
    { href: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/staff/visitors", label: "Visitors", icon: Users, exclude: ["/staff/visitors/register"] },
    { href: "/staff/visitors/register", label: "Register Walk-in", icon: UserPlus },
    { href: "/staff/scanner", label: "Scan QR", icon: ScanLine },
    { href: "/staff/reports", label: "Reports", icon: FileBarChart },
  ],
  guard: [
    { href: "/guard/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/guard", label: "Scan QR", icon: ScanLine, exact: true },
    { href: "/guard/visitors", label: "On-site Visitors", icon: Users, exclude: ["/guard/visitors/register"] },
    { href: "/guard/visitors/register", label: "Register Walk-in", icon: UserPlus },
  ],
};

function NavLink({
  item,
  active,
  children,
}: {
  item: NavItem;
  active: boolean;
  children?: React.ReactNode;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-[var(--brand-soft)] font-semibold text-[var(--brand)]"
          : "font-medium text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
      )}
    >
      <Icon className={cx("h-4 w-4", active ? "text-[var(--brand)]" : "text-[var(--muted)]")} />
      {children ?? item.label}
    </Link>
  );
}

type SidebarProps = {
  userName?: string;
  userRole?: string;
  portal: Portal;
};

export function Sidebar({ userName, userRole, portal }: SidebarProps) {
  const pathname = usePathname();
  const items = NAV_ITEMS[portal];

  return (
    <aside className="no-print flex h-full w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--border)] bg-white p-1 shadow-xs">
            <img src="/logo.png" alt="EVSU Logo" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight tracking-tight text-[var(--foreground)]">
              Visitor Management
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase leading-[1.5] tracking-[0.14em] text-[var(--muted)]">
              Eastern Visayas State University
            </p>
          </div>
        </div>
        <div className="mt-4 h-0.5 w-10 bg-[var(--accent)]" />
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]/80">
            {PORTAL_LABELS[portal]}
          </p>
          <div className="space-y-1">
            {items.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href) &&
                  !(item.exclude ?? []).some((prefix) => pathname.startsWith(prefix));
              return <NavLink key={item.href} item={item} active={active} />;
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-[var(--border)] p-3">
        {userName && (
          <div className="mb-2 flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2.5 py-2">
            <Avatar name={userName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight">{userName}</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--muted)]">
                {userRole?.toLowerCase()}
              </p>
            </div>
          </div>
        )}
        <form action={logoutAction}>
          <button type="submit" className={buttonClass("ghost", "w-full justify-start text-[var(--danger)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)]")}>
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </form>
      </div>
    </aside>
  );
}
