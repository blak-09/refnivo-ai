import type { NextAuthConfig } from "next-auth";
import type { UserRole, UserStatus } from "@prisma/client";

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
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.status = user.status;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.status = token.status as UserStatus;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
