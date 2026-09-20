"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2Icon, PackageCheckIcon } from "lucide-react";
import { submitOrderClaimAction } from "@/app/actions/order-claims";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";

/**
 * Order handshake, customer side: after buying on the brand's store, the
 * customer submits their order number so the brand can confirm it and credit
 * the person who referred them. Works without an account.
 */
export function OrderClaimForm({ campaignId, brandName, referralCode, referrerName }: { campaignId: string; brandName: string; referralCode?: string | null; referrerName?: string | null }) {
  const [state, action] = useActionState(submitOrderClaimAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  const [open, setOpen] = React.useState(false);

  if (state?.ok) {
    return (
      <Card id="claim" className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="flex items-start gap-3 py-5">
          <CheckCircle2Icon className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div className="text-sm">
            <p className="font-medium">Order submitted — thank you!</p>
            <p className="mt-1 text-muted-foreground">
              {brandName} will match it against their store and confirm it{referrerName ? `, and ${referrerName} gets credited` : ""}. Nothing else to do.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="claim" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center gap-2">
          <PackageCheckIcon className="size-5 text-primary" aria-hidden />
          <CardTitle className="text-lg">Already ordered? Confirm your order</CardTitle>
        </div>
        <CardDescription>
          Bought this on {brandName}&apos;s store? Enter your order number so the brand can confirm it{referrerName ? ` and credit ${referrerName}` : " and credit the person who referred you"}. Takes 20 seconds, no account needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            I have an order number
          </Button>
        ) : (
          <form key={attempt} action={action} className="space-y-4" noValidate>
            <input type="hidden" name="campaignId" value={campaignId} />
            {/* Honeypot: hidden from people, filled by bots. */}
            <div className="hidden" aria-hidden>
              <label htmlFor="claim-website">Website</label>
              <input id="claim-website" name="website" tabIndex={-1} autoComplete="off" />
            </div>
            <FormError message={state && !state.ok ? state.error : null} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Order number" htmlFor="claim-order" error={errors.orderReference} required hint="From your order confirmation e-mail or receipt.">
                <Input id="claim-order" name="orderReference" defaultValue={values.orderReference} placeholder="#10482" required aria-invalid={!!errors.orderReference} />
              </Field>
              <Field label="Email or phone used for the order" htmlFor="claim-contact" error={errors.contact} required hint="Only a masked version is shown to the brand; we store a hash, never the value.">
                <Input id="claim-contact" name="contact" defaultValue={values.contact} placeholder="you@example.com" required aria-invalid={!!errors.contact} autoComplete="email" />
              </Field>
              <Field label="Referral code" htmlFor="claim-code" error={errors.code} required hint={referralCode ? "Pre-filled from the link you used." : "The code from the link, QR or flyer you were given."}>
                <Input id="claim-code" name="code" defaultValue={values.code ?? referralCode ?? ""} placeholder="NAME-BRAND-4K7Q" className="font-mono uppercase" required aria-invalid={!!errors.code} />
              </Field>
              <Field label="Note (optional)" htmlFor="claim-note" error={errors.note}>
                <Textarea id="claim-note" name="note" defaultValue={values.note} rows={1} placeholder="e.g. ordered 2 units" />
              </Field>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Submitting a claim never charges you. The brand decides after checking their store.</p>
              <SubmitButton pendingText="Submitting…">Submit order</SubmitButton>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
