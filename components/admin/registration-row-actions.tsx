"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, Loader2Icon, XIcon } from "lucide-react";
import { approveUserAction, rejectUserAction } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/dashboard/primitives";
import { ROLE_LABEL } from "@/lib/auth/roles";

export type AdminRegistration = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "BRAND_OWNER" | "CREATOR" | "CUSTOMER" | "ADMIN";
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
  registrationId: string | null;
  createdAt: Date;
  approvedAt: Date | null;
  rejectedAt: Date | null;
  rejectionReason: string | null;
  details: Record<string, string | number> | null;
};

const DETAIL_LABELS: Record<string, string> = {
  brandName: "Brand name",
  brandWebsite: "Brand website",
  brandCategory: "Brand category",
  brandDescription: "Brand description",
  creatorName: "Creator name",
  creatorCategory: "Content category",
  instagramHandle: "Instagram handle",
  instagramFollowers: "Instagram followers",
  youtubeChannel: "YouTube channel",
  youtubeSubscribers: "YouTube subscribers",
};

function DetailRows({ reg }: { reg: AdminRegistration }) {
  const rows: [string, string][] = [
    ["Full name", reg.name],
    ["Email", reg.email],
    ["Phone", reg.phone || "—"],
    ["Role", ROLE_LABEL[reg.role]],
    ["Registration ID", reg.registrationId ?? "—"],
    ["Registered on", reg.createdAt.toLocaleString()],
  ];
  const details = reg.details ?? {};
  for (const [key, label] of Object.entries(DETAIL_LABELS)) {
    const v = details[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") rows.push([label, String(v)]);
  }
  if (reg.status === "REJECTED" && reg.rejectionReason) rows.push(["Rejection reason", reg.rejectionReason]);
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 px-3 py-2">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="max-w-[60%] break-words text-right font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function RegistrationRowActions({ reg }: { reg: AdminRegistration }) {
  const router = useRouter();
  const [view, setView] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState<null | "approve" | "reject">(null);

  const canDecide = reg.status === "PENDING" || reg.status === "REJECTED" || reg.status === "SUSPENDED";
  const canReject = reg.status === "PENDING" || reg.status === "APPROVED";

  async function approve() {
    setPending("approve");
    try {
      const fd = new FormData();
      fd.set("userId", reg.id);
      const res = await approveUserAction(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${reg.name} approved.`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function reject() {
    setPending("reject");
    try {
      const fd = new FormData();
      fd.set("userId", reg.id);
      fd.set("reason", reason);
      const res = await rejectUserAction(null, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${reg.name} rejected.`);
      setRejectOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setView(true)}>
        <EyeIcon /> Details
      </Button>
      {canDecide && reg.status !== "APPROVED" ? (
        <Button size="sm" disabled={pending !== null} onClick={approve}>
          {pending === "approve" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Approve
        </Button>
      ) : null}
      {canReject ? (
        <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => setRejectOpen(true)}>
          <XIcon /> Reject
        </Button>
      ) : null}

      {/* Details */}
      <Dialog open={view} onOpenChange={setView}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {reg.name} <StatusBadge status={reg.status} />
            </DialogTitle>
            <DialogDescription>Registration details submitted at signup.</DialogDescription>
          </DialogHeader>
          <DetailRows reg={reg} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setView(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject with reason */}
      <Dialog
        open={rejectOpen}
        onOpenChange={(o) => {
          setRejectOpen(o);
          if (!o) setReason("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {reg.name}?</DialogTitle>
            <DialogDescription>
              The applicant will see this reason when they check their registration status. They will not be able to sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="reject-reason" className="text-sm font-medium">
              Reason for rejection
            </label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. Brand website could not be verified."
              maxLength={500}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)} disabled={pending === "reject"}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={reject} disabled={reason.trim().length < 3 || pending === "reject"}>
              {pending === "reject" ? <Loader2Icon className="animate-spin" /> : <XIcon />} Reject account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
