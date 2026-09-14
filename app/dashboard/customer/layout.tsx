import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { requireRole } from "@/lib/auth/guards";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("CUSTOMER");
  return (
    <DashboardShell
      navKey="customer"
      roleLabel="Customer"
      workspaceName={user.name}
      workspaceSubtitle="Customer rewards"
      user={{ name: user.name, email: user.email }}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
