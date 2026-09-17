import type { NextAuthConfig } from "next-auth";
import type { UserRole, UserStatus } from "@prisma/client";
import { sessionCookieOptions, tokenSessionVersion } from "./session-version";

/**
 * Edge-safe Auth.js configuration (no database imports). Used by `proxy.ts`
 * for route protection and extended in `lib/auth/index.ts` with the
 * Credentials provider that talks to Prisma.
 */
export const authConfig = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  },
  trustHost: true,
  // Explicit so Auth.js throws MissingSecret (never signs with an empty secret).
  secret: process.env.AUTH_SECRET,
  // Explicit cookie hardening (matches Auth.js defaults; Secure + __Secure- prefix under https).
  cookies: {
    sessionToken: sessionCookieOptions(process.env.NEXTAUTH_URL || process.env.AUTH_URL),
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.name = user.name;
        token.sv = tokenSessionVersion(user.sessionVersion);
        token.mcp = user.mustChangePassword === true;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.status = token.status as UserStatus;
        session.user.name = (token.name as string) ?? session.user.name;
        // Old tokens (issued before versioning) carry no `sv` → version 1.
        session.user.sessionVersion = tokenSessionVersion(token.sv);
        session.user.mustChangePassword = token.mcp === true;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
