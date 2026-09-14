import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { roleForDashboardPath, roleHome } from "@/lib/auth/roles";

const { auth } = NextAuth(authConfig);

/**
 * First line of route protection. Every dashboard page ALSO re-checks the
 * session and ownership server-side (see lib/auth/guards.ts) — this proxy
 * only handles fast redirects.
 */
export default auth((req) => {
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
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/dashboard", "/auth/:path*"],
};
