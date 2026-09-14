"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArchiveIcon, Loader2Icon } from "lucide-react";
import { archiveProductAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ArchiveProductButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function archive() {
    setPending(true);
    try {
      const res = await archiveProductAction(productId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Product archived.");
      setOpen(false);
      router.push("/dashboard/brand/products");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ArchiveIcon /> Archive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this product?</DialogTitle>
            <DialogDescription>
              Archived products are hidden from the marketplace and cannot be used in new campaigns. Live campaigns must be ended first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={archive} disabled={pending}>
              {pending ? <Loader2Icon className="animate-spin" /> : null} Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
