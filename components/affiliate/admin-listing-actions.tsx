"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AffiliateProgramStatus } from "@prisma/client";
import { LinkIcon, StarIcon } from "lucide-react";
import { adminAffiliateProgramStateAction, adminCheckProgramLinkAction, adminFeatureProgramAction } from "@/app/actions/affiliate";
import { Button } from "@/components/ui/button";

type StateAction = "ACTIVATE" | "DEACTIVATE" | "CLOSE" | "REOPEN" | "DELETE";

/**
 * Admin maintenance for any listing: edit, activate / deactivate, feature,
 * re-check the official link, close (history kept), reopen into review, or
 * delete while no creator uses it.
 */
export function AdminListingActions({ id, status, creatorLinks, featured }: { id: string; status: AffiliateProgramStatus; creatorLinks: number; featured: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run(action: StateAction) {
    const confirmText: Partial<Record<StateAction, string>> = {
      DEACTIVATE: "Deactivate this listing? It leaves the marketplace and creators' Refnivo links stop forwarding until it is activated again.",
      CLOSE: "Close this listing? It leaves the marketplace and creators' Refnivo links stop forwarding. Click history is kept.",
      REOPEN: "Put this listing back in the review queue?",
      DELETE: "Delete this listing permanently? This cannot be undone.",
    };
    if (confirmText[action] && !window.confirm(confirmText[action])) return;
    setPending(true);
    try {
      const res = await adminAffiliateProgramStateAction({ id, action });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const done: Record<StateAction, string> = { ACTIVATE: "Listing is active.", DEACTIVATE: "Listing deactivated.", CLOSE: "Listing closed.", REOPEN: "Back in the review queue.", DELETE: "Listing deleted." };
      toast.success(done[action]);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function toggleFeatured() {
    setPending(true);
    try {
      const res = await adminFeatureProgramAction({ id, featured: !featured });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success(featured ? "Removed from featured." : "Featured.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  async function checkLink() {
    setPending(true);
    try {
      const res = await adminCheckProgramLinkAction({ id });
      if (!res.ok) toast.error(res.error);
      else if (res.data.reachable) toast.success(`Official link works (${res.data.status}).`);
      else toast.error(`Official link is not working (${res.data.status}).${res.data.unverified ? " The Verified mark was removed." : ""}`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/admin/affiliate-programs/${id}`} />}>
        Edit
      </Button>
      {status === "APPROVED" ? (
        <Button size="sm" variant="outline" onClick={() => run("DEACTIVATE")} disabled={pending}>
          Deactivate
        </Button>
      ) : (
        <Button size="sm" onClick={() => run("ACTIVATE")} disabled={pending}>
          Activate
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={toggleFeatured} disabled={pending} aria-pressed={featured} title={featured ? "Unfeature" : "Feature"}>
        <StarIcon className={featured ? "size-4 fill-amber-400 text-amber-500" : "size-4"} aria-hidden /> {featured ? "Featured" : "Feature"}
      </Button>
      <Button size="sm" variant="ghost" onClick={checkLink} disabled={pending} title="Re-check the official program URL">
        <LinkIcon className="size-4" aria-hidden /> Check link
      </Button>
      {["DRAFT", "REJECTED", "PAUSED", "CLOSED"].includes(status) ? (
        <Button size="sm" variant="ghost" onClick={() => run("REOPEN")} disabled={pending}>
          Reopen
        </Button>
      ) : null}
      {status !== "CLOSED" ? (
        <Button size="sm" variant="ghost" onClick={() => run("CLOSE")} disabled={pending}>
          Close
        </Button>
      ) : null}
      {creatorLinks === 0 ? (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => run("DELETE")} disabled={pending}>
          Delete
        </Button>
      ) : null}
    </div>
  );
}
