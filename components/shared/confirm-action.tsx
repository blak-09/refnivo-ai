"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/utils/action-result";

type Props = {
  /** Button label. */
  label: React.ReactNode;
  title: string;
  description?: string;
  /** Show a text input; its value is passed to `run`. */
  input?: { label: string; placeholder?: string; required?: boolean; defaultValue?: string };
  confirmLabel?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  successMessage?: string;
  /** Server action to run. Must return an ActionResult. */
  run: (value: string) => Promise<ActionResult<unknown>>;
  /** Skip the dialog and run immediately (for low-risk actions). */
  immediate?: boolean;
  disabled?: boolean;
};

/**
 * Generic "confirm → run server action → toast → refresh" button. Success is
 * only shown after the action reports `ok: true`; failures show the server's
 * message and keep the dialog open so the user can retry.
 */
export function ConfirmAction({ label, title, description, input, confirmLabel, variant = "outline", size = "sm", successMessage, run, immediate, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [value, setValue] = React.useState(input?.defaultValue ?? "");

  async function execute() {
    if (input?.required && !value.trim()) {
      toast.error(`${input.label} is required.`);
      return;
    }
    setPending(true);
    try {
      const res = await run(value);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(successMessage ?? "Done.");
      setOpen(false);
      setValue(input?.defaultValue ?? "");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button size={size} variant={variant} disabled={disabled || pending} onClick={() => (immediate ? execute() : setOpen(true))}>
        {pending && immediate ? <Loader2Icon className="animate-spin" /> : null}
        {label}
      </Button>
      {!immediate ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
            {input ? (
              <div className="space-y-1.5">
                <label htmlFor="confirm-action-input" className="text-sm font-medium">
                  {input.label}
                  {input.required ? <span className="text-destructive"> *</span> : null}
                </label>
                <Input id="confirm-action-input" value={value} onChange={(e) => setValue(e.target.value)} placeholder={input.placeholder} autoFocus />
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant={variant === "destructive" ? "destructive" : "default"} onClick={execute} disabled={pending}>
                {pending ? <Loader2Icon className="animate-spin" /> : null}
                {confirmLabel ?? "Confirm"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
