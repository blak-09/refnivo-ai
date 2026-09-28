"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { createChannelLinkAction } from "@/app/actions/channel-links";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export type LinkableCampaign = { campaignId: string; name: string; brandName: string };

const CHANNELS = [
  { value: "INSTAGRAM", label: "Instagram", hint: "Bio, story link sticker, or a DM." },
  { value: "YOUTUBE", label: "YouTube", hint: "Video or livestream description, or a pinned comment." },
  { value: "FACEBOOK", label: "Facebook", hint: "A post, your page, or a live description." },
  { value: "LINKEDIN", label: "LinkedIn", hint: "A post, or your featured section." },
  { value: "X", label: "X", hint: "A post, or your profile link." },
];

/**
 * "Add a channel link": pick a campaign you are already in and the platform you
 * will share on. The new link is an ordinary referral link with the channel
 * baked into its code, so every click and sale on it is credited to that
 * channel — nothing is guessed from where a click appears to come from.
 */
export function ChannelLinkPicker({ campaigns }: { campaigns: LinkableCampaign[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [campaignId, setCampaignId] = React.useState(campaigns[0]?.campaignId ?? "");
  const [source, setSource] = React.useState("INSTAGRAM");

  if (!campaigns.length) return null;
  const hint = CHANNELS.find((c) => c.value === source)?.hint;

  async function submit() {
    setPending(true);
    try {
      const res = await createChannelLinkAction({ campaignId, source });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Link ready: ${res.data.code}`);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="size-4" aria-hidden /> Add a channel link
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a link for one platform</DialogTitle>
            <DialogDescription>
              Share this link only on the platform you choose. Sales through it are credited to that platform in your analytics.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="channel-campaign">Campaign</Label>
              <NativeSelect id="channel-campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                {campaigns.map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>
                    {c.name} · {c.brandName}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="channel-source">Channel</Label>
              <NativeSelect id="channel-source" value={source} onChange={(e) => setSource(e.target.value)}>
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
              {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending || !campaignId}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlusIcon className="size-4" aria-hidden />} Create link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
