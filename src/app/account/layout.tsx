import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <header className="bg-[var(--brand)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-6 text-white">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />
            <span className="font-display text-sm font-semibold tracking-tight">Account Settings</span>
          </div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--accent)] hover:underline"
          >
            Back to app
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
    </div>
  );
}
