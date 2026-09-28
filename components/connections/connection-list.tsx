"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { respondToConnectionAction } from "@/app/actions/connections";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/products/product-thumb";
import type { ConnectionRow } from "@/lib/services/connections";
import { formatDate } from "@/lib/utils/dates";

type Viewer = "BRAND" | "CREATOR";

/** The other party, from whichever side is looking. */
function counterpart(row: ConnectionRow, viewer: Viewer) {
  if (viewer === "BRAND") {
    const p = row.creator.creatorProfile;
    return {
      name: p?.displayName ?? row.creator.name,
      subtitle: p?.category ?? "Creator",
      image: p?.profileImageUrl ?? null,
      href: p?.username ? `/creators/${p.username}` : null,
      meta: [p?.instagramFollowers ? `${p.instagramFollowers.toLocaleString("en-IN")} on Instagram` : null, p?.youtubeSubscribers ? `${p.youtubeSubscribers.toLocaleString("en-IN")} on YouTube` : null]
        .filter(Boolean)
        .join(" · "),
    };
  }
  return { name: row.brand.name, subtitle: row.brand.industry ?? "Brand", image: row.brand.logoUrl, href: row.brand.slug ? `/brands/${row.brand.slug}` : null, meta: row.brand.tagline ?? "" };
}

export function ConnectionList({ rows, viewer }: { rows: ConnectionRow[]; viewer: Viewer }) {
  return (
    <ul className="grid gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <ConnectionCard row={row} viewer={viewer} />
        </li>
      ))}
    </ul>
  );
}

function ConnectionCard({ row, viewer }: { row: ConnectionRow; viewer: Viewer }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"ACCEPT" | "DECLINE" | null>(null);
  const other = counterpart(row, viewer);
  // A pending request is "incoming" only for the side that did not open it.
  const incoming = row.status === "PENDING" && row.initiator !== viewer;

  async function respond(decision: "ACCEPT" | "DECLINE") {
    setPending(decision);
    try {
      const res = await respondToConnectionAction({ connectionId: row.id, decision });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "ACCEPT" ? `Connected with ${other.name}.` : "Request declined.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <BrandLogo src={other.image} name={other.name} className="size-12 rounded-xl" sizes="48px" />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {other.href ? (
                <Link href={other.href} className="text-sm font-semibold hover:underline">
                  {other.name}
                </Link>
              ) : (
                <span className="text-sm font-semibold">{other.name}</span>
              )}
              <StatusChip status={row.status} incoming={incoming} />
            </div>
            <p className="text-xs text-muted-foreground">{other.subtitle}{other.meta ? ` · ${other.meta}` : ""}</p>
            {row.message ? <p className="text-sm text-muted-foreground">“{row.message}”</p> : null}
            {row.status === "DECLINED" && row.responseNote ? <p className="text-xs text-muted-foreground">Reason: {row.responseNote}</p> : null}
            <p className="text-xs text-muted-foreground">
              {row.status === "PENDING" ? `Requested ${formatDate(row.createdAt)}` : `Updated ${formatDate(row.respondedAt ?? row.createdAt)}`}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {incoming ? (
            <>
              <Button size="sm" onClick={() => respond("ACCEPT")} disabled={pending !== null}>
                {pending === "ACCEPT" ? <Loader2Icon className="animate-spin" aria-hidden /> : <CheckIcon className="size-4" aria-hidden />} Accept
              </Button>
              <Button size="sm" variant="outline" onClick={() => respond("DECLINE")} disabled={pending !== null}>
                {pending === "DECLINE" ? <Loader2Icon className="animate-spin" aria-hidden /> : <XIcon className="size-4" aria-hidden />} Decline
              </Button>
            </>
          ) : null}
          {other.href ? (
            <Button size="sm" variant="outline" nativeButton={false} render={<Link href={other.href} />}>
              View profile
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusChip({ status, incoming }: { status: ConnectionRow["status"]; incoming: boolean }) {
  if (status === "ACCEPTED") return <Badge className="gap-1"><CheckIcon className="size-3" aria-hidden /> Connected</Badge>;
  if (status === "PENDING") return <Badge variant="secondary">{incoming ? "Awaiting your reply" : "Request sent"}</Badge>;
  if (status === "BLOCKED") return <Badge variant="outline">Blocked</Badge>;
  return <Badge variant="outline">Declined</Badge>;
}
