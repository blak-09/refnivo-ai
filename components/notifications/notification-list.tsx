"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BellIcon, CheckCheckIcon, Loader2Icon } from "lucide-react";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/dashboard/primitives";
import { formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
};

export function NotificationList({ items }: { items: NotificationItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [pendingAll, setPendingAll] = React.useState(false);
  const unread = items.filter((n) => !n.readAt).length;

  async function markRead(id: string) {
    setPendingId(id);
    try {
      const res = await markNotificationReadAction({ id });
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function markAll() {
    setPendingAll(true);
    try {
      const res = await markAllNotificationsReadAction();
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    } finally {
      setPendingAll(false);
    }
  }

  if (!items.length) {
    return <EmptyState icon={BellIcon} title="No notifications yet" description="Application decisions, verified orders, payouts and account updates will appear here." />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{unread ? `${unread} unread` : "All caught up"}</span>
        <Button size="sm" variant="ghost" onClick={markAll} disabled={!unread || pendingAll}>
          {pendingAll ? <Loader2Icon className="animate-spin" /> : <CheckCheckIcon />} Mark all as read
        </Button>
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {items.map((n) => {
          const unreadItem = !n.readAt;
          return (
            <li key={n.id} className={cn("flex gap-3 px-4 py-3", unreadItem && "bg-primary/5")}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", unreadItem ? "bg-primary" : "bg-transparent")} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", unreadItem ? "font-semibold" : "font-medium")}>
                  {n.href ? (
                    <Link href={n.href} onClick={() => unreadItem && markRead(n.id)} className="hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </div>
              {unreadItem ? (
                <Button size="sm" variant="ghost" onClick={() => markRead(n.id)} disabled={pendingId === n.id} aria-label="Mark as read">
                  {pendingId === n.id ? <Loader2Icon className="animate-spin" /> : "Mark read"}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
