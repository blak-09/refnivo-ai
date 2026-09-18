import { logoutAction } from "@/app/actions/auth";
import { DashboardShell } from "@/components/dashboard/shell";
import { countUnread } from "@/lib/services/notify";
import { requireCreator } from "@/lib/auth/guards";

export default async function CreatorLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireCreator();
  const unreadNotifications = await countUnread(user.id);
  return (
    <DashboardShell
      navKey="creator"
      roleLabel="Creator"
      workspaceName={profile.displayName}
      workspaceSubtitle={`@${profile.username}`}
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      unreadNotifications={unreadNotifications}
      onLogout={logoutAction}
    >
      {children}
    </DashboardShell>
  );
}
