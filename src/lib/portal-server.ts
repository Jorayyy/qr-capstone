import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, type SessionUser } from "@/lib/auth";
import { portalForRole, portalHome, type Portal } from "@/lib/portal";

/** Sends old (pre-portal) URLs to the same page inside the visitor's portal. */
export async function legacyRedirectTo(resolve: (portal: Portal) => string): Promise<never> {
  const session = await requireSession();

  if (session.mustChangePassword) {
    redirect("/account/password");
  }

  redirect(resolve(portalForRole(session.role)));
}

/** Portal of the page currently rendering, set by proxy.ts from the URL prefix. */
export async function currentPortal(): Promise<Portal> {
  const store = await headers();
  const value = store.get("x-portal");
  return value === "admin" || value === "staff" || value === "guard" ? value : "admin";
}

/**
 * Enforces both authentication and portal ownership. Admin keeps full access
 * to every portal; everyone else is bounced to their own home when they
 * wander into another role's portal.
 */
export async function requirePortal(portal: Portal): Promise<SessionUser> {
  const session = await requireSession();

  if (session.mustChangePassword) {
    redirect("/account/password");
  }

  if (session.role !== "ADMIN" && portalForRole(session.role) !== portal) {
    redirect(portalHome(session.role));
  }

  return session;
}
