import type { UserRole, UserStatus } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      status: UserStatus;
      /** Session version embedded at login; compared with the DB on every request. */
      sessionVersion: number;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    role: UserRole;
    status: UserStatus;
    sessionVersion?: number;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    status?: UserStatus;
    /** Session version. Tokens issued before this claim existed are treated as version 1. */
    sv?: number;
    /** Must-change-password flag captured at login. */
    mcp?: boolean;
  }
}
