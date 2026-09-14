"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { recordOrderAction } from "@/app/actions/conversions";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";

export function RecordOrderForm() {
  const [state, action] = useActionState(recordOrderAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) {
      toast.success("Order recorded — verify it below to release the commission or reward.");
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form key={attempt} ref={formRef} action={action} className="space-y-4" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Referral code" htmlFor="code" error={errors.code} required hint="From the order's ?ref= parameter or the coupon the customer used.">
          <Input id="code" name="code" defaultValue={values.code} placeholder="ARJUN-BOAT-4K7Q" className="font-mono uppercase" required aria-invalid={!!errors.code} />
        </Field>
        <Field label="Order reference" htmlFor="orderReference" error={errors.orderReference} required hint="Your store's order ID. Must be unique.">
          <Input id="orderReference" name="orderReference" defaultValue={values.orderReference} placeholder="#BOAT-10482" required aria-invalid={!!errors.orderReference} />
        </Field>
        <Field label="Order value (₹)" htmlFor="amount" error={errors.amount} required>
          <Input id="amount" name="amount" type="number" inputMode="decimal" min={1} step="1" defaultValue={values.amount} placeholder="1499" required aria-invalid={!!errors.amount} />
        </Field>
        <Field label="Quantity" htmlFor="quantity" error={errors.quantity}>
          <Input id="quantity" name="quantity" type="number" inputMode="numeric" min={1} defaultValue={values.quantity ?? "1"} />
        </Field>
        <Field label="How was the code captured?" htmlFor="source" error={errors.source}>
          <NativeSelect id="source" name="source" defaultValue={values.source ?? "REFERRAL_CODE"}>
            <option value="REFERRAL_CODE">Referral link / coupon code</option>
            <option value="QR_SCAN">QR code scan</option>
            <option value="MANUAL">Manual attribution</option>
            <option value="IMPORT">Imported from store</option>
          </NativeSelect>
        </Field>
        <Field label="Customer email or phone (optional)" htmlFor="customerContact" error={errors.customerContact} hint="Stored only as a hash — used to block self-referrals and duplicates.">
          <Input id="customerContact" name="customerContact" defaultValue={values.customerContact} placeholder="customer@example.com" />
        </Field>
        <Field label="Note (optional)" htmlFor="note" error={errors.note} className="sm:col-span-2">
          <Input id="note" name="note" defaultValue={values.note} placeholder="Delivered 12 Sep, no return" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingText="Recording…">Record order</SubmitButton>
      </div>
    </form>
  );
}
