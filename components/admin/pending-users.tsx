import { setUserApprovalAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function PendingUsers({
  users,
}: {
  users: { id: string; name: string; role: string; status: string; createdAt: Date }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Accounts awaiting approval ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts are waiting for review.</p>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                <div>
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.role.replaceAll("_", " ").toLowerCase()} · Joined {user.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <form action={setUserApprovalAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value="APPROVED" />
                    <Button type="submit" size="sm">Approve</Button>
                  </form>
                  <form action={setUserApprovalAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="status" value="SUSPENDED" />
                    <Button type="submit" size="sm" variant="outline">Reject</Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
