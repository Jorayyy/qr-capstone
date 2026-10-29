export type Portal = "admin" | "staff" | "guard";

export const PORTAL_LABELS: Record<Portal, string> = {
  admin: "Admin Portal",
  staff: "Staff Portal",
  guard: "Guard Portal",
};

/** SECURITY is the guard account; RECEPTIONIST works from the staff portal. */
export function portalForRole(role: string | null | undefined): Portal {
  if (role === "ADMIN") return "admin";
  if (role === "SECURITY") return "guard";
  return "staff";
}

/** Landing page of each portal. */
export function portalHomePath(portal: Portal): string {
  return `/${portal}/dashboard`;
}

/** Where a role lands after signing in. */
export function portalHome(role: string | null | undefined): string {
  return portalHomePath(portalForRole(role));
}

/** Joins a portal root with an in-portal path. */
export function portalHref(portal: Portal, path = ""): string {
  const suffix = path && path !== "/" ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `/${portal}${suffix}`;
}
