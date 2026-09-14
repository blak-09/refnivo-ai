import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { prisma } from "@/lib/db/prisma";
import { QUICK_DEMO_ACCOUNTS, showDemoLogins } from "@/lib/utils/demo";

export const metadata: Metadata = { title: "Log in" };

/** Only offer quick sign-in buttons for demo accounts that actually exist in this database. */
async function getQuickAccounts() {
  if (!showDemoLogins()) return [];
  try {
    const existing = await prisma.user.findMany({
      where: { email: { in: QUICK_DEMO_ACCOUNTS.map((a) => a.email) }, status: "APPROVED" },
      select: { email: true },
    });
    const emails = new Set(existing.map((u) => u.email));
    return QUICK_DEMO_ACCOUNTS.filter((a) => emails.has(a.email)).map((a) => ({ ...a }));
  } catch {
    return [];
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; registered?: string }>;
}) {
  const { callbackUrl, error, registered } = await searchParams;
  const safeCallback = callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : undefined;
  const notice = registered
    ? "Your account was created and is waiting for admin approval. You can log in after approval."
    : error
      ? "Please log in to continue."
      : undefined;
  const quickAccounts = await getQuickAccounts();

  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard title="Welcome back" description="Log in to your Refnivo AI account.">
          <LoginForm callbackUrl={safeCallback} notice={notice} quickAccounts={quickAccounts} />
        </AuthCard>
        {!quickAccounts.length ? (
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo accounts are listed in the README after running <code className="font-mono">npm run db:seed</code>.
          </p>
        ) : null}
      </div>
    </div>
  );
}
