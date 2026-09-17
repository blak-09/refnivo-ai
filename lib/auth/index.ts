import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { requireAuthSecret } from "@/lib/config/env";
import { authConfig } from "./config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  // Fail at boot (not on first request) if the secret is missing.
  secret: requireAuthSecret(),
  providers: [
    Credentials({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (user.status !== "APPROVED") return null;

        // Best-effort: never block a login on this bookkeeping write.
        prisma.user.updateMany({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          sessionVersion: user.sessionVersion,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
