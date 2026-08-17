import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// /admin must stay open pre-auth: with zero users it renders the first-admin bootstrap
// modal itself (self-guarded server-side); with a session it re-checks role there.
// /api/setup backs that bootstrap and self-disables once any user exists. /api/auth/*
// are Better Auth's own sign-in/sign-out/session endpoints, which by definition run
// unauthenticated.
const PUBLIC_PATHS = new Set(["/login", "/admin", "/api/setup"]);

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname) || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Cheap, cookie-only check (no DB round trip) — good enough to gate at the edge of
  // the app. Pages/route handlers that need the actual user (id, role) call
  // auth.api.getSession() themselves, which is the authoritative check.
  if (getSessionCookie(request)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
