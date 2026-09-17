"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2Icon, ClockIcon, Loader2Icon, LinkIcon, XCircleIcon } from "lucide-react";
import { joinCampaignAction } from "@/app/actions/creator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/forms/field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  campaignId: string;
  campaignSlug: string;
  campaignName: string;
  brandName: string;
  productName: string;
  viewer: { role: "CREATOR" | "CUSTOMER" | "BRAND_OWNER" | "ADMIN"; name: string; hasCreatorProfile: boolean } | null;
  applicationStatus: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN" | "REMOVED" | null;
  requiresApproval: boolean;
  campaignType: "CREATOR_AFFILIATE" | "CUSTOMER_REFERRAL" | "HYBRID";
  live: boolean;
};

function Notice({ tone, icon: Icon, children }: { tone: "muted" | "pending" | "rejected"; icon: React.ElementType; children: React.ReactNode }) {
  const cls =
    tone === "pending"
      ? "border-warning/40 bg-warning/10"
      : tone === "rejected"
        ? "border-destructive/30 bg-destructive/5 text-destructive"
        : "bg-muted/40 text-muted-foreground";
  return (
    <p className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
      <Icon className="size-4 shrink-0" /> {children}
    </p>
  );
}

export function JoinCampaignPanel({
  campaignId,
  campaignSlug,
  campaignName,
  brandName,
  productName,
  viewer,
  applicationStatus,
  requiresApproval,
  campaignType,
  live,
}: Props) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const returnTo = encodeURIComponent(`/campaigns/${campaignSlug}`);

  if (!live) {
    return <Notice tone="muted" icon={ClockIcon}>This campaign is not accepting new partners right now.</Notice>;
  }

  if (!viewer) {
    return (
      <div className="space-y-2">
        <Button className="w-full" nativeButton={false} render={<Link href={`/auth/login?callbackUrl=${returnTo}`} />}>
          <LinkIcon /> Join campaign &amp; get your link
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          New here?{" "}
          {campaignType !== "CUSTOMER_REFERRAL" ? (
            <Link href={`/auth/register?role=CREATOR&callbackUrl=${returnTo}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Sign up as a creator
            </Link>
          ) : null}
          {campaignType === "HYBRID" ? " · " : ""}
          {campaignType !== "CREATOR_AFFILIATE" ? (
            <Link href={`/auth/register?role=CUSTOMER&callbackUrl=${returnTo}`} className="font-medium text-primary underline-offset-4 hover:underline">
              Sign up as a customer
            </Link>
          ) : null}
        </p>
      </div>
    );
  }

  if (viewer.role === "BRAND_OWNER" || viewer.role === "ADMIN") {
    return <Notice tone="muted" icon={ClockIcon}>Only creators and customers can join campaigns.</Notice>;
  }
  if (viewer.role === "CREATOR" && campaignType === "CUSTOMER_REFERRAL") {
    return <Notice tone="muted" icon={ClockIcon}>This campaign is for customers only.</Notice>;
  }
  if (viewer.role === "CUSTOMER" && campaignType === "CREATOR_AFFILIATE") {
    return <Notice tone="muted" icon={ClockIcon}>This campaign is for creators only.</Notice>;
  }
  if (viewer.role === "CREATOR" && !viewer.hasCreatorProfile) {
    return (
      <Button className="w-full" nativeButton={false} render={<Link href="/auth/onboarding" />}>
        Complete your creator profile to apply
      </Button>
    );
  }
  if (applicationStatus === "PENDING") {
    return <Notice tone="pending" icon={ClockIcon}>Application sent — {brandName} is reviewing your profile. Your link appears here once approved.</Notice>;
  }
  if (applicationStatus === "REJECTED") {
    return <Notice tone="rejected" icon={XCircleIcon}>Your application to this campaign was not approved.</Notice>;
  }
  if (applicationStatus === "REMOVED") {
    return <Notice tone="rejected" icon={XCircleIcon}>The brand removed you from this campaign. Your referral link for it is disabled.</Notice>;
  }

  const needsApplication = viewer.role === "CREATOR" && requiresApproval;

  async function submit() {
    setPending(true);
    try {
      const res = await joinCampaignAction({ campaignId, message });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.data.status === "APPROVED" ? "You're in — your referral link is ready." : `Application sent to ${brandName}.`);
      setOpen(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  // Instant join (customers, or creators on no-approval campaigns).
  if (!needsApplication) {
    return (
      <div className="space-y-2">
        <Button className="w-full" onClick={submit} disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <LinkIcon />} Join &amp; generate my referral link
        </Button>
        <p className="text-center text-xs text-muted-foreground">You get a unique link and QR code instantly.</p>
      </div>
    );
  }

  // Approval-required: open an application modal.
  return (
    <>
      <div className="space-y-2">
        <Button className="w-full" onClick={() => setOpen(true)} disabled={pending}>
          <LinkIcon /> Apply to this campaign
        </Button>
        <p className="text-center text-xs text-muted-foreground">{brandName} reviews creator profiles before issuing links.</p>
      </div>

      <Dialog open={open} onOpenChange={(o) => (pending ? null : setOpen(o))}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply to {brandName}</DialogTitle>
            <DialogDescription>
              {campaignName} · {productName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <p className="text-xs text-muted-foreground">Applying as</p>
              <p className="font-medium">{viewer.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {brandName} will see your public creator profile, social handles and audience details with this application.
              </p>
            </div>
            <Field label="Why are you a good fit? (optional)" htmlFor="apply-message" hint="Shared with the brand along with your profile.">
              <Textarea
                id="apply-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={500}
                placeholder="Tell the brand why you want to promote this product and how you plan to create content."
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : <CheckCircle2Icon />} Submit application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
