"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, Loader2Icon, PauseIcon, PencilIcon, PlayIcon, RocketIcon, SquareIcon, Trash2Icon } from "lucide-react";
import type { CampaignStatus } from "@prisma/client";
import { campaignStatusAction, deleteDraftCampaignAction } from "@/app/actions/campaigns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { availableActions, canEdit } from "@/lib/domain/campaign-rules";
import type { CampaignAction } from "@/lib/validation/campaign";

const ACTION_META: Record<
  CampaignAction,
  { label: string; icon: React.ElementType; variant: "default" | "outline" | "destructive"; confirm: { title: string; body: string; checkbox?: string } | null }
> = {
  PUBLISH: {
    label: "Publish",
    icon: RocketIcon,
    variant: "default",
    confirm: {
      title: "Publish this campaign?",
      body: "The campaign goes live on the marketplace. Creators and customers can join and share links; commissions and rewards become payable for every order you verify.",
      checkbox: "I confirm the commission, reward and campaign rules.",
    },
  },
  PAUSE: {
    label: "Pause",
    icon: PauseIcon,
    variant: "outline",
    confirm: { title: "Pause this campaign?", body: "Existing links stop producing eligible orders until you resume. Orders awaiting verification are unaffected." },
  },
  RESUME: { label: "Resume", icon: PlayIcon, variant: "default", confirm: null },
  END: {
    label: "End",
    icon: SquareIcon,
    variant: "outline",
    confirm: { title: "End this campaign?", body: "The campaign stops permanently. You can still verify orders recorded before it ended." },
  },
  ARCHIVE: {
    label: "Archive",
    icon: ArchiveIcon,
    variant: "outline",
    confirm: { title: "Archive this campaign?", body: "Archived campaigns are hidden from lists and cannot be edited or reactivated." },
  },
};

export function CampaignActions({ campaignId, status, problems }: { campaignId: string; status: CampaignStatus; problems: string[] }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<CampaignAction | "DELETE" | null>(null);
  const [dialog, setDialog] = React.useState<CampaignAction | "DELETE" | null>(null);
  const [checked, setChecked] = React.useState(false);

  const actions = availableActions(status);
  const blocked = problems.length > 0;

  async function run(action: CampaignAction) {
    setPending(action);
    try {
      const res = await campaignStatusAction({ campaignId, action, confirmed: true });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Campaign ${res.data.status.toLowerCase()}.`);
      setDialog(null);
      setChecked(false);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("DELETE");
    try {
      const res = await deleteDraftCampaignAction(campaignId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Draft deleted.");
      router.push("/dashboard/brand/campaigns");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  const meta = dialog && dialog !== "DELETE" ? ACTION_META[dialog] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit(status) ? (
        <Button variant="outline" nativeButton={false} render={<Link href={`/dashboard/brand/campaigns/${campaignId}/edit`} />}>
          <PencilIcon /> Edit
        </Button>
      ) : null}
      {actions.map((a) => {
        const m = ACTION_META[a];
        const disabled = (a === "PUBLISH" || a === "RESUME") && blocked;
        return (
          <Button
            key={a}
            variant={m.variant}
            disabled={disabled || pending !== null}
            title={disabled ? problems.join(" ") : undefined}
            onClick={() => (m.confirm ? setDialog(a) : run(a))}
          >
            {pending === a ? <Loader2Icon className="animate-spin" /> : <m.icon />}
            {m.label}
          </Button>
        );
      })}
      {status === "DRAFT" ? (
        <Button variant="destructive" disabled={pending !== null} onClick={() => setDialog("DELETE")}>
          <Trash2Icon /> Delete draft
        </Button>
      ) : null}

      <Dialog open={dialog !== null} onOpenChange={(o) => { if (!o) { setDialog(null); setChecked(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog === "DELETE" ? "Delete this draft?" : meta?.confirm?.title}</DialogTitle>
            <DialogDescription>
              {dialog === "DELETE" ? "The draft and its settings will be permanently removed." : meta?.confirm?.body}
            </DialogDescription>
          </DialogHeader>
          {meta?.confirm?.checkbox ? (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
              {meta.confirm.checkbox}
            </label>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)} disabled={pending !== null}>
              Cancel
            </Button>
            {dialog === "DELETE" ? (
              <Button variant="destructive" onClick={remove} disabled={pending !== null}>
                {pending === "DELETE" ? <Loader2Icon className="animate-spin" /> : null} Delete
              </Button>
            ) : dialog ? (
              <Button onClick={() => run(dialog)} disabled={pending !== null || (!!meta?.confirm?.checkbox && !checked)}>
                {pending === dialog ? <Loader2Icon className="animate-spin" /> : null} {meta?.label}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
