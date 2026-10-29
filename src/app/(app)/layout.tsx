import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";

/**
 * Legacy routes now live inside the role portals. This layout only keeps the
 * auth guard; the pages themselves redirect to /admin, /staff or /guard.
 */
export default async function LegacyLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();

  if (session.mustChangePassword) {
    redirect("/account/password");
  }

  return <>{children}</>;
}
