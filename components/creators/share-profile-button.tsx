"use client";

import { Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Copies the current profile URL to the clipboard. */
export function ShareProfileButton({ className }: { className?: string }) {
  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Profile link copied.");
    } catch {
      toast.error("Could not share this profile.");
    }
  }
  return (
    <Button variant="outline" className={className} onClick={share}>
      <Share2Icon /> Share profile
    </Button>
  );
}
