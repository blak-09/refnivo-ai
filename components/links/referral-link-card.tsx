"use client";

/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { toast } from "sonner";
import { CheckIcon, CopyIcon, DownloadIcon, MessageCircleIcon, QrCodeIcon, SendIcon, Share2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ShareTargets } from "@/lib/services/links";

export type ReferralLinkProps = {
  code: string;
  url: string;
  qrDataUrl: string;
  share: ShareTargets;
  shareText: string;
  /** Rendered above the controls, e.g. product name. */
  title?: React.ReactNode;
  stats?: { clicks: number; qrScans?: number; conversions: number };
  compact?: boolean;
};

export function useCopy() {
  const [copied, setCopied] = React.useState(false);
  const copy = React.useCallback(async (text: string, label = "Link copied.") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(label);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy. Long-press the link to copy it manually.");
    }
  }, []);
  return { copied, copy };
}

export function ReferralLinkCard({ code, url, qrDataUrl, share, shareText, title, stats, compact }: ReferralLinkProps) {
  const { copied, copy } = useCopy();
  const [qrOpen, setQrOpen] = React.useState(false);

  async function nativeShare() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Refnivo AI", text: shareText, url });
        return;
      } catch {
        /* user cancelled or unsupported — fall back to copy */
      }
    }
    copy(url);
  }

  return (
    <div className="space-y-3 rounded-xl border p-4">
      {title ? <div className="text-sm font-medium">{title}</div> : null}
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs sm:text-sm">{url}</code>
        <Button size="sm" variant={copied ? "default" : "outline"} onClick={() => copy(url)} aria-label="Copy referral link">
          {copied ? <CheckIcon /> : <CopyIcon />} {compact ? null : "Copy"}
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>
          Code <code className="font-mono font-medium text-foreground">{code}</code>
        </span>
        <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => copy(code, "Code copied.")}>
          copy code
        </button>
        {stats ? (
          <span className="ml-auto tabular-nums">
            {stats.clicks} clicks{stats.qrScans !== undefined ? ` · ${stats.qrScans} QR` : ""} · {stats.conversions} verified
          </span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => setQrOpen(true)}>
          <QrCodeIcon /> QR code
        </Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<a href={share.whatsapp} target="_blank" rel="noreferrer" />}>
          <MessageCircleIcon /> WhatsApp
        </Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<a href={share.twitter} target="_blank" rel="noreferrer" />}>
          <SendIcon /> X
        </Button>
        <Button size="sm" variant="outline" nativeButton={false} render={<a href={share.telegram} target="_blank" rel="noreferrer" />}>
          <SendIcon /> Telegram
        </Button>
        <Button size="sm" variant="ghost" onClick={nativeShare}>
          <Share2Icon /> Share…
        </Button>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your QR code</DialogTitle>
            <DialogDescription>Scans open your referral link and are tracked separately from clicks. Print it on flyers, packaging or show it in videos.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            <img src={qrDataUrl} alt={`QR code for referral code ${code}`} className="size-56 rounded-lg border bg-white p-2" />
            <code className="font-mono text-sm">{code}</code>
            <Button nativeButton={false} render={<a href={qrDataUrl} download={`refnivo-${code}.png`} />}>
              <DownloadIcon /> Download PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
