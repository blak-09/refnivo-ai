import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/primitives";
import { AccountDetailsForm, ChangePasswordForm } from "@/components/account/account-forms";
import { NotificationPreferences } from "@/components/account/notification-preferences";
import { prisma } from "@/lib/db/prisma";
import { isEmailConfigured } from "@/lib/email";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/guards";

/** Shared account settings page used by every role's dashboard. */
export async function SettingsPage({ user, extra }: { user: SessionUser; extra?: React.ReactNode }) {
  const full = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: {
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      emailNotifications: true,
      passwordHash: true,
    },
  });
  const hasPassword = full.passwordHash !== null;
  // Separate query, tolerant of a deploy that lands before the google_oauth
  // migration: the page must never 500 over an informational line.
  const linkedProviders = await prisma.oAuthAccount
    .findMany({ where: { userId: user.id }, select: { provider: true }, orderBy: { createdAt: "asc" } })
    .then((rows) => rows.map((a) => a.provider))
    .catch(() => [] as string[]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={`Signed in as ${ROLE_LABEL[user.role].toLowerCase()}.`} />
      {user.mustChangePassword ? (
        <div role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">Set a new password to continue.</p>
          <p className="mt-1">
            This account was created with a temporary password. Choose a new one below — you will be signed out everywhere and asked to log in again.
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
            <CardDescription>Your name is shown to partners you work with.</CardDescription>
          </CardHeader>
          <CardContent>
            <AccountDetailsForm user={full} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Password</CardTitle>
            <CardDescription>
              {hasPassword ? "Choose a strong password you do not use elsewhere." : "You sign in with Google. Add a password to also log in with e-mail."}
              {linkedProviders.includes("google") ? " Google sign-in is linked to this account." : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPassword ? (
              <ChangePasswordForm />
            ) : (
              <p className="text-sm text-muted-foreground">
                This account has no password yet. Use{" "}
                <Link href="/auth/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
                  Forgot password
                </Link>{" "}
                to receive a link and set one (requires e-mail delivery to be configured).
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Choose whether important updates are also sent by e-mail.</CardDescription>
          </CardHeader>
          <CardContent>
            <NotificationPreferences emailNotifications={full.emailNotifications} emailConfigured={isEmailConfigured()} />
          </CardContent>
        </Card>
        {extra}
      </div>
    </div>
  );
}
