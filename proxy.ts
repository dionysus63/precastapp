import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  // The login page itself sends signed-in users home (it can check the
  // session against the database; this can only see that a cookie exists).
  // Redirecting here on a mere cookie looped forever on a dead one — after a
  // password reset, deactivation or expiry — between "/" and "/login".
  if (pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // Desktop client auto-update files (latest.yml + installer) — no login required.
  if (pathname.startsWith("/updates")) {
    return NextResponse.next();
  }

  if (!hasSession && !pathname.startsWith("/api/")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Forward the pathname as a REQUEST header so server components can read
  // it via headers(). Overwriting unconditionally also means a client can
  // never spoof it. (Setting it on the response, as before, made it
  // invisible to headers() — the permission check downstream fell back to
  // "/" and passed vacuously.)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
