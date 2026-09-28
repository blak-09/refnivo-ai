import Link from "next/link";
import { HandshakeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/dashboard/primitives";
import { ConnectionList } from "@/components/connections/connection-list";
import { CONNECTION_TABS, connectionCounts, listConnections, type ConnectionTab, type Viewer } from "@/lib/services/connections";
import { cn } from "@/lib/utils";

const TAB_LABEL: Record<ConnectionTab, string> = { ALL: "All", INCOMING: "Incoming", SENT: "Sent", ACCEPTED: "Accepted", DECLINED: "Declined" };
const PAGE_SIZE = 20;

const EMPTY: Record<ConnectionTab, { title: string; description: string }> = {
  ALL: { title: "No connections yet", description: "Find someone to work with and send a request — they see your profile and your message." },
  INCOMING: { title: "No requests waiting", description: "Requests sent to you appear here to accept or decline." },
  SENT: { title: "No requests sent", description: "Requests you send stay here until the other side replies." },
  ACCEPTED: { title: "No connections yet", description: "Accepted connections appear here, ready to collaborate." },
  DECLINED: { title: "Nothing declined", description: "Declined and blocked requests are kept here for your records." },
};

/**
 * Connections dashboard, shared by both sides — the viewer decides whose rows
 * are loaded and which of a pending pair counts as "incoming". Paginated, so a
 * busy account never loads every connection at once.
 */
export async function ConnectionsPage({
  viewer,
  basePath,
  discover,
  searchParams,
}: {
  viewer: Viewer;
  basePath: string;
  discover: { href: string; label: string };
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const tab = (CONNECTION_TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as ConnectionTab) : "ALL";
  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const [{ rows, hasMore, total }, counts] = await Promise.all([
    listConnections(viewer, tab, { take: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE }),
    connectionCounts(viewer),
  ]);

  const href = (t: ConnectionTab, p = 1) => `${basePath}?tab=${t}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Connections"
        description="Direct relationships with the people you work with. Accepting a request opens the door to a collaboration."
        actions={
          <Button nativeButton={false} render={<Link href={discover.href} />}>
            {discover.label}
          </Button>
        }
      />

      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter connections">
        {CONNECTION_TABS.map((t) => (
          <Link
            key={t}
            href={href(t)}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              tab === t ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {TAB_LABEL[t]}
            {counts[t] ? <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums">{counts[t]}</span> : null}
          </Link>
        ))}
      </div>

      {!rows.length ? (
        <EmptyState
          icon={HandshakeIcon}
          title={EMPTY[tab].title}
          description={EMPTY[tab].description}
          action={
            <Button size="sm" nativeButton={false} render={<Link href={discover.href} />}>
              {discover.label}
            </Button>
          }
        />
      ) : (
        <>
          <ConnectionList rows={rows} viewer={viewer.kind} />
          {total > PAGE_SIZE ? (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + rows.length} of {total}
              </span>
              <div className="flex gap-2">
                {page > 1 ? (
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href(tab, page - 1)} />}>
                    Previous
                  </Button>
                ) : null}
                {hasMore ? (
                  <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href(tab, page + 1)} />}>
                    Next
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
