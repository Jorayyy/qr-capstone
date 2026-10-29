import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

/**
 * Optimistic route protection (Next.js 16 "proxy" - replaces middleware).
 *
 * This only checks for the *presence* of a session cookie to redirect
 * anonymous visitors early. It is a UX layer, NOT a security boundary:
 * authentication (valid, unexpired, unrevoked session + active user) and
 * authorization (role/permission) are enforced server-side in layouts,
 * server actions and API routes via getSession()/requirePermission().
 *
 * The /login page performs its own real session check, so a stale cookie
 * can never cause a redirect loop here.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/visitors",
  "/departments",
  "/scanner",
  "/security",
  "/reports",
  "/account",
  "/admin",
  "/staff",
  "/guard",
];

const PORTALS = ["admin", "staff", "guard"] as const;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  const portal = PORTALS.find(
    (value) => pathname === `/${value}` || pathname.startsWith(`/${value}/`)
  );
  if (portal) requestHeaders.set("x-portal", portal);
  else requestHeaders.delete("x-portal");

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/visitors/:path*",
    "/departments/:path*",
    "/scanner/:path*",
    "/security/:path*",
    "/reports/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/staff/:path*",
    "/guard/:path*",
  ],
};
