import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/primitives";
import { AccountDetailsForm, ChangePasswordForm } from "@/components/account/account-forms";
import { prisma } from "@/lib/db/prisma";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { SessionUser } from "@/lib/auth/guards";

/** Shared account settings page used by every role's dashboard. */
export async function SettingsPage({ user, extra }: { user: SessionUser; extra?: React.ReactNode }) {
  const full = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, phone: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={`Signed in as ${ROLE_LABEL[user.role].toLowerCase()}.`} />
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
            <CardDescription>Choose a strong password you do not use elsewhere.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
        {extra}
      </div>
    </div>
  );
}
