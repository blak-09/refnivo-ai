"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopy } from "@/components/links/referral-link-card";

/** The store coupon for a campaign's shopper offer, with a copy button (W7). */
export function CouponCode({ code, brandName }: { code: string; brandName: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="rounded-lg border border-dashed border-primary/50 bg-background px-3 py-1.5 font-mono text-sm font-semibold tracking-wider">{code}</span>
      <Button type="button" size="sm" variant="outline" onClick={() => copy(code, "Coupon code copied.")}>
        {copied ? <CheckIcon /> : <CopyIcon />} {copied ? "Copied" : "Copy code"}
      </Button>
      <p className="w-full text-xs text-muted-foreground">Enter this code at checkout on {brandName}&apos;s store.</p>
    </div>
  );
}
