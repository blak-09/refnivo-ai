"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { decideApplicationAction } from "@/app/actions/partners";
import { Button } from "@/components/ui/button";

export function ApplicationDecision({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(decision: "APPROVED" | "REJECTED") {
    setPending(decision);
    try {
      const res = await decideApplicationAction({ applicationId, decision });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(decision === "APPROVED" ? "Partner approved — their referral link is ready." : "Application rejected.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => decide("APPROVED")} disabled={pending !== null}>
        {pending === "APPROVED" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve
      </Button>
      <Button size="sm" variant="outline" onClick={() => decide("REJECTED")} disabled={pending !== null}>
        {pending === "REJECTED" ? <Loader2Icon className="animate-spin" /> : <XIcon />} Reject
      </Button>
    </div>
  );
}
