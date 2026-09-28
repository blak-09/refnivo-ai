"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2Icon, ExternalLinkIcon, InfoIcon, Loader2Icon, RefreshCwIcon, TriangleAlertIcon, UnlinkIcon } from "lucide-react";
import { disconnectSocialAccountAction, refreshSocialAccountAction } from "@/app/actions/social-accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandLogo } from "@/components/products/product-thumb";
import type { PublicSocialAccount } from "@/lib/services/social-accounts";
import { formatDate } from "@/lib/utils/dates";

export type PlatformRow = {
  platform: string;
  label: string;
  configured: boolean;
  reason: string | null;
  purpose: string | null;
  scopes: string[];
  followerMetric: { available: boolean; reason?: string } | null;
  account: PublicSocialAccount | null;
};

/**
 * One platform. Three states, each honest about what it can do:
 *  - connected: handle, link, and a follower count ONLY if the platform gave us
 *    one; otherwise the reason it cannot;
 *  - connectable: a Connect button that starts the platform's own OAuth flow;
 *  - unavailable on this deployment: says so, with no dead button.
 */
export function SocialAccountCard({ row }: { row: PlatformRow }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"disconnect" | "refresh" | null>(null);
  const [confirming, setConfirming] = React.useState(false);
  const account = row.account;

  async function run(kind: "disconnect" | "refresh") {
    setPending(kind);
    try {
      const res = kind === "disconnect" ? await disconnectSocialAccountAction({ platform: row.platform }) : await refreshSocialAccountAction({ platform: row.platform });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(kind === "disconnect" ? `${row.label} disconnected. Your earnings history is unchanged.` : `${row.label} refreshed.`);
      setConfirming(false);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card className="h-full rounded-2xl">
      <CardContent className="flex h-full flex-col gap-3">
        <div className="flex items-start gap-3">
          <BrandLogo src={account?.avatarUrl ?? null} name={row.label} className="size-10 rounded-xl" sizes="40px" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{row.label}</h3>
              {account?.status === "CONNECTED" ? (
                <Badge className="gap-1">
                  <CheckCircle2Icon className="size-3" aria-hidden /> Connected
                </Badge>
              ) : account?.status === "NEEDS_RECONNECT" ? (
                <Badge variant="outline" className="gap-1 text-amber-700">
                  <TriangleAlertIcon className="size-3" aria-hidden /> Reconnect needed
                </Badge>
              ) : null}
            </div>
            {account ? (
              <p className="truncate text-sm text-muted-foreground">{account.handle ?? "Linked"}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{row.configured ? "Not connected" : "Unavailable on this deployment"}</p>
            )}
          </div>
        </div>

        {account ? (
          <div className="space-y-1 text-sm">
            {account.followers !== null ? (
              <p>
                <span className="font-semibold tabular-nums">{account.followers.toLocaleString("en-IN")}</span>{" "}
                <span className="text-muted-foreground">followers{account.followersSyncedAt ? ` · synced ${formatDate(account.followersSyncedAt)}` : ""}</span>
              </p>
            ) : (
              // Never a number we did not receive.
              <p className="text-xs text-muted-foreground">{account.followersUnavailableReason ?? "Follower count not available through the platform API."}</p>
            )}
            {account.scopes.length ? <p className="text-xs text-muted-foreground">Permissions granted: {account.scopes.join(", ")}</p> : null}
          </div>
        ) : row.configured ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            {row.purpose ? <p>{row.purpose}</p> : null}
            {row.followerMetric && !row.followerMetric.available ? (
              <p className="inline-flex items-start gap-1">
                <InfoIcon className="mt-0.5 size-3 shrink-0" aria-hidden /> {row.followerMetric.reason}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{row.reason}</p>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {account && account.status !== "DISCONNECTED" ? (
            <>
              {account.profileUrl ? (
                <Button size="sm" variant="outline" nativeButton={false} render={<a href={account.profileUrl} target="_blank" rel="noreferrer noopener" aria-label={`View your ${row.label} profile (opens in a new tab)`} />}>
                  View profile <ExternalLinkIcon className="size-3.5" aria-hidden />
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => run("refresh")} disabled={pending !== null}>
                {pending === "refresh" ? <Loader2Icon className="animate-spin" aria-hidden /> : <RefreshCwIcon className="size-3.5" aria-hidden />} Refresh
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(true)} disabled={pending !== null}>
                <UnlinkIcon className="size-3.5" aria-hidden /> Disconnect
              </Button>
            </>
          ) : row.configured ? (
            // A plain link: the platform authenticates the creator, we never see a password.
            <Button size="sm" nativeButton={false} render={<a href={`/api/social/${row.platform.toLowerCase()}/start`} />}>
              Connect {row.label}
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled>
              Not available yet
            </Button>
          )}
        </div>

        <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Disconnect {row.label}?</DialogTitle>
              <DialogDescription>
                Refnivo forgets the connection and deletes the access it was given. Your campaigns, referral links, orders, commissions and payouts are not
                affected — nothing you have earned is removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConfirming(false)} disabled={pending !== null}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => run("disconnect")} disabled={pending !== null}>
                {pending === "disconnect" ? <Loader2Icon className="animate-spin" aria-hidden /> : <UnlinkIcon className="size-4" aria-hidden />} Disconnect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
