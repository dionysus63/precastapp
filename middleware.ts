import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (pathname.startsWith("/login")) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/", request.url));
    }

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
