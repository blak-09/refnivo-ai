import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/dashboard/primitives";
import { RegistrationRowActions, type AdminRegistration } from "@/components/admin/registration-row-actions";
import { ROLE_LABEL } from "@/lib/auth/roles";

export function PendingUsers({ users }: { users: AdminRegistration[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Accounts awaiting approval ({users.length})</CardTitle>
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard/admin/registrations" />}>
          View all registrations
        </Button>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts are waiting for review.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{user.name}</p>
                    <StatusBadge status={user.status} />
                  </div>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email} · {ROLE_LABEL[user.role]} · Joined {user.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <RegistrationRowActions reg={user} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
