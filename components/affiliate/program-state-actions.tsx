"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AffiliateProgramStatus } from "@prisma/client";
import { affiliateProgramStateAction } from "@/app/actions/affiliate";
import { Button } from "@/components/ui/button";

/** Brand-side lifecycle controls, offered only when the transition is allowed. */
export function ProgramStateActions({ id, status }: { id: string; status: AffiliateProgramStatus }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function run(action: "PAUSE" | "RESUME" | "CLOSE") {
    if (action === "CLOSE" && !window.confirm("Close this listing? Creators will no longer see it, and existing Refnivo links stop forwarding.")) return;
    setPending(true);
    try {
      const res = await affiliateProgramStateAction({ id, action });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(action === "PAUSE" ? "Listing paused." : action === "RESUME" ? "Sent back for review." : "Listing closed.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {status !== "CLOSED" && status !== "PENDING_REVIEW" ? (
        <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/dashboard/brand/affiliate-programs/${id}`} />}>
          Edit
        </Button>
      ) : null}
      {status === "APPROVED" ? (
        <Button size="sm" variant="outline" onClick={() => run("PAUSE")} disabled={pending}>
          Pause
        </Button>
      ) : null}
      {status === "PAUSED" ? (
        <Button size="sm" onClick={() => run("RESUME")} disabled={pending}>
          Resume
        </Button>
      ) : null}
      {status !== "CLOSED" ? (
        <Button size="sm" variant="ghost" onClick={() => run("CLOSE")} disabled={pending}>
          Close
        </Button>
      ) : null}
    </>
  );
}
