import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { roleForDashboardPath, roleHome } from "@/lib/auth/roles";
import { rotationRedirect } from "@/lib/auth/session-version";
import { isMisconfigured } from "@/lib/config/boot-state";
import { canonicalRedirect } from "@/lib/config/canonical-host";

const { auth } = NextAuth(authConfig);

/**
 * A misconfigured production deployment (see lib/config/boot-state.ts) must
 * never run application code: answer 503 with a pointer to /api/health, which
 * lists the failing rules by variable name. Static assets and the health
 * endpoint itself are excluded by the matcher / the check below.
 */
function misconfiguredResponse() {
  return new NextResponse("Refnivo AI is being configured. Operators: see /api/health for the failing configuration rules.", {
    status: 503,
    headers: { "Cache-Control": "no-store", "Retry-After": "60", "Content-Type": "text/plain; charset=utf-8" },
  });
}

/**
 * First line of route protection. Every dashboard page ALSO re-checks the
 * session and ownership server-side (see lib/auth/guards.ts) — this proxy
 * only handles fast redirects.
 */
const authProxy = auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const user = req.auth?.user;

  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/auth/onboarding");
  const isAuthEntry = pathname === "/auth/login" || pathname === "/auth/register";

  if ((isDashboard || isOnboarding) && !user) {
    const login = new URL("/auth/login", nextUrl);
    login.searchParams.set("callbackUrl", pathname + nextUrl.search);
    return NextResponse.redirect(login);
  }

  if (user) {
    if (isAuthEntry) {
      return NextResponse.redirect(new URL(roleHome(user.role), nextUrl));
    }
    if (pathname === "/dashboard" || pathname === "/dashboard/") {
      return NextResponse.redirect(new URL(roleHome(user.role), nextUrl));
    }
    const requiredRole = roleForDashboardPath(pathname);
    if (isDashboard && requiredRole !== user.role) {
      return NextResponse.redirect(new URL(roleHome(user.role), nextUrl));
    }
    // Forced password rotation: the JWT claim is fresh because completing a
    // change bumps the session version and signs the user out.
    const rotate = rotationRedirect({ mustChangePassword: user.mustChangePassword, pathname, roleHome: roleHome(user.role) });
    if (rotate) return NextResponse.redirect(new URL(rotate, nextUrl));
  }

  return NextResponse.next();
});

const PROTECTED = /^\/(dashboard|auth)(\/|$)/;

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname !== "/api/health" && (isMisconfigured() || !process.env.AUTH_SECRET?.trim())) return misconfiguredResponse();
  const canonical = canonicalRedirect({ host: req.headers.get("host"), protocol: req.nextUrl.protocol, pathname, search: req.nextUrl.search });
  if (canonical) return NextResponse.redirect(canonical, { status: 308 });
  // Session-aware handling only where it matters; everything else passes straight through.
  if (PROTECTED.test(pathname)) return authProxy(req as never, {} as never);
  return NextResponse.next();
}

export const config = {
  // Everything except static assets; /api/health is excluded inside `proxy` so it can report the misconfiguration.
  matcher: ["/((?!_next/static|_next/image|favicon\.ico|icon\.svg|robots\.txt|sitemap\.xml|uploads/).*)"],
};
