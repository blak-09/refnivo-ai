"use client";

import * as React from "react";
import { useActionState } from "react";
import { AlertTriangleIcon, Loader2Icon } from "lucide-react";
import { deleteAccountAction } from "@/app/actions/account";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { formatMoney } from "@/lib/money";
import type { DeletionPreview } from "@/lib/services/account-deletion";

const PHRASE = "DELETE";

/**
 * Settings → Danger zone. Two-step: an explicit button opens a dialog that
 * spells out what will happen, requires the typed phrase and (for password
 * accounts) the current password, and only then posts to the server action —
 * which re-verifies everything and signs the user out on success.
 */
export function DeleteAccountCard({ preview }: { preview: DeletionPreview }) {
  const [open, setOpen] = React.useState(false);
  const [state, action, pending] = useActionState(deleteAccountAction, null);
  const [phrase, setPhrase] = React.useState("");
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const ready = phrase.trim() === PHRASE;

  if (preview.role === "ADMIN") {
    return (
      <p className="text-sm text-muted-foreground">
        Admin accounts cannot be deleted from Settings. Ask another admin to remove your admin access first; the last admin can never be removed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Permanently delete your account. Your personal data is removed and your sign-in stops working immediately. This cannot be undone.
      </p>
      <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <form action={action} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangleIcon className="size-5 text-destructive" aria-hidden /> Delete your account?
              </DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </DialogHeader>

            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Your name, e-mail, phone, photo, password and Google link are deleted. You can register again later with the same e-mail.</li>
              {preview.brand ? (
                <li>
                  <span className="font-medium text-foreground">{preview.brand.name}</span> is removed from the marketplace: {preview.brand.activeCampaigns} active campaign
                  {preview.brand.activeCampaigns === 1 ? "" : "s"} end and {preview.brand.partners} partner link{preview.brand.partners === 1 ? "" : "s"} stop working.
                </li>
              ) : (
                <li>Your referral links stop working and pending applications are withdrawn.</li>
              )}
              {preview.forfeitedBalance > 0 ? (
                <li className="font-medium text-destructive">
                  An approved balance of {formatMoney(preview.forfeitedBalance)} has not been requested for payout and will be forfeited. Request a payout first if you want it.
                </li>
              ) : null}
              <li>Order, commission and reward records are kept for the brands and partners you worked with, without your personal details.</li>
            </ul>

            {preview.openPayoutRequest ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
                You have a payout request in progress. It must be settled or cancelled before the account can be deleted.
              </p>
            ) : null}

            <FormError message={state && !state.ok ? state.error : null} />

            {preview.hasPassword ? (
              <Field label="Current password" htmlFor="delete-password" error={errors.currentPassword} required>
                <Input id="delete-password" name="currentPassword" type="password" autoComplete="current-password" required aria-invalid={!!errors.currentPassword} />
              </Field>
            ) : (
              <p className="text-xs text-muted-foreground">You sign in with Google, so no password is needed — the typed confirmation below is your re-authentication.</p>
            )}
            <Field label={`Type ${PHRASE} to confirm`} htmlFor="delete-confirmation" error={errors.confirmation} required>
              <Input id="delete-confirmation" name="confirmation" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" placeholder={PHRASE} required />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={!ready || pending || preview.openPayoutRequest}>
                {pending ? (
                  <>
                    <Loader2Icon className="animate-spin" /> Deleting…
                  </>
                ) : (
                  "Delete account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
