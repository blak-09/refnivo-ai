import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { countUnread } from "@/lib/services/notify";
import { requireCustomer } from "@/lib/auth/guards";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomer();
  const unreadNotifications = await countUnread(user.id);
  return (
    <DashboardShell
      navKey="customer"
      roleLabel="Customer"
      workspaceName={user.name}
      workspaceSubtitle="Customer rewards"
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      unreadNotifications={unreadNotifications}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
