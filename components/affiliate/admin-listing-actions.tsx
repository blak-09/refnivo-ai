"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AffiliateProgramStatus } from "@prisma/client";
import { adminAffiliateProgramStateAction } from "@/app/actions/affiliate";
import { Button } from "@/components/ui/button";

/**
 * Admin maintenance for any listing: edit, close (off the marketplace, history
 * kept), reopen into the review queue, or delete while no creator uses it.
 */
export function AdminListingActions({ id, status, creatorLinks }: { id: string; status: AffiliateProgramStatus; creatorLinks: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run(action: "CLOSE" | "REOPEN" | "DELETE") {
    const confirmText = {
      CLOSE: "Close this listing? It leaves the marketplace and creators' Refnivo links stop forwarding. Click history is kept.",
      REOPEN: "Put this listing back in the review queue?",
      DELETE: "Delete this listing permanently? This cannot be undone.",
    }[action];
    if (!window.confirm(confirmText)) return;
    setPending(true);
    try {
      const res = await adminAffiliateProgramStateAction({ id, action });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(action === "CLOSE" ? "Listing closed." : action === "REOPEN" ? "Back in the review queue." : "Listing deleted.");
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
      {["DRAFT", "REJECTED", "PAUSED", "CLOSED"].includes(status) ? (
        <Button size="sm" variant="outline" onClick={() => run("REOPEN")} disabled={pending}>
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
