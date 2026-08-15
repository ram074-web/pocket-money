import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-shared";

// First line of defence: anything without a session cookie is bounced to the
// login screen before it reaches a page or API route.
//
// This is a cheap cookie-presence check — middleware runs on the edge runtime
// where Prisma isn't available, so the cookie is not validated here. Real
// verification (session exists, not expired, user still active, role allows
// the domain) happens server-side in every page and API route via
// requireUser()/requireAccess(). Deleting a session or deactivating a user
// therefore takes effect immediately, regardless of this check.
const PUBLIC_PATHS = ["/login", "/manifest.webmanifest", "/sw.js"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/icons/") ||
    pathname.startsWith("/_next/")
  ) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)) {
    // API callers get a JSON 401 rather than an HTML redirect.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
