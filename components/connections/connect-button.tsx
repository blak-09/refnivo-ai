"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckIcon, ClockIcon, HandshakeIcon, Loader2Icon } from "lucide-react";
import { connectWithBrandAction, connectWithCreatorAction } from "@/app/actions/connections";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export type ConnectState = "NONE" | "PENDING_SENT" | "PENDING_INCOMING" | "ACCEPTED" | "DECLINED" | "BLOCKED" | "UNAVAILABLE";

/**
 * "Connect" on a public brand or creator profile.
 *
 * The target id is all the client sends — the caller's own side comes from the
 * session on the server. The button reflects the relationship that already
 * exists, so a second request is not offered when one is already waiting.
 */
export function ConnectButton({
  target,
  name,
  state,
  size,
  className,
}: {
  target: { kind: "BRAND"; brandId: string } | { kind: "CREATOR"; creatorId: string };
  name: string;
  state: ConnectState;
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState("");

  if (state === "UNAVAILABLE") return null;

  if (state === "ACCEPTED") {
    return (
      <Button size={size} variant="outline" className={className} disabled>
        <CheckIcon className="size-4" aria-hidden /> Connected
      </Button>
    );
  }
  if (state === "PENDING_SENT") {
    return (
      <Button size={size} variant="outline" className={className} disabled>
        <ClockIcon className="size-4" aria-hidden /> Request sent
      </Button>
    );
  }
  if (state === "PENDING_INCOMING") {
    return (
      <Button size={size} variant="outline" className={className} onClick={() => router.push(target.kind === "BRAND" ? "/dashboard/creator/connections" : "/dashboard/brand/connections")}>
        Respond to request
      </Button>
    );
  }
  if (state === "BLOCKED") return null;

  async function send() {
    setPending(true);
    try {
      const res =
        target.kind === "CREATOR"
          ? await connectWithCreatorAction({ creatorId: target.creatorId, message })
          : await connectWithBrandAction({ brandId: target.brandId, message });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Request sent.");
      setOpen(false);
      setMessage("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)}>
        <HandshakeIcon className="size-4" aria-hidden /> Connect
      </Button>
      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect with {name}</DialogTitle>
            <DialogDescription>
              {target.kind === "CREATOR" ? "Why would you like to collaborate?" : "Tell the brand why you want to collaborate."} They see this with your profile.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Message"
            rows={4}
            maxLength={600}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={
              target.kind === "CREATOR"
                ? "e.g. We're launching a new range and your audience looks like a strong fit."
                : "e.g. I create technology and startup content and would love to explore a collaboration around your products."
            }
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <HandshakeIcon className="size-4" aria-hidden />} Send request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
