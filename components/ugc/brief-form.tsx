"use client";

import Link from "next/link";
import { Loader2Icon, SaveIcon } from "lucide-react";
import { saveBriefAction } from "@/app/actions/ugc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormError } from "@/components/forms/field";
import { ChoiceChips } from "@/components/onboarding/form-kit";
import { UGC_CONTENT_TYPES, UGC_MAX_CREATORS, UGC_USAGE_RIGHTS } from "@/lib/ugc/options";
import { useActionForm } from "./use-action-form";

export type BriefFormDefaults = {
  title?: string;
  description?: string;
  deliverables?: string;
  contentTypes?: string[];
  feeRupees?: string;
  creatorsNeeded?: string;
  usageRights?: string;
  usageNotes?: string;
  productId?: string;
  productShipped?: boolean;
  applyBy?: string;
  deliverBy?: string;
};

/** Create / edit a UGC brief. Saves as a draft (or keeps the current status); publishing is a separate step. */
export function BriefForm({ briefId, defaults = {}, products }: { briefId?: string; defaults?: BriefFormDefaults; products: { id: string; name: string }[] }) {
  const { pending, onSubmit, errors, error } = useActionForm(saveBriefAction);
  const d = defaults;

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate aria-busy={pending}>
      <FormError message={error} />
      {briefId ? <input type="hidden" name="briefId" value={briefId} /> : null}

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-base font-semibold">What do you need?</h2>
        <Field label="Title" htmlFor="title" error={errors.title} required hint="Creators see this first, e.g. “Unboxing reel for our wireless earbuds”.">
          <Input id="title" name="title" defaultValue={d.title} maxLength={100} aria-invalid={!!errors.title} />
        </Field>
        <Field label="Brief" htmlFor="description" error={errors.description} required hint="The idea, tone, key messages, and anything to avoid.">
          <Textarea id="description" name="description" rows={6} defaultValue={d.description} maxLength={3000} aria-invalid={!!errors.description} />
        </Field>
        <Field label="Deliverables" htmlFor="deliverables" error={errors.deliverables} required hint="Exactly what each creator delivers, e.g. “1 vertical video (30–45 s) + 3 photos”.">
          <Input id="deliverables" name="deliverables" defaultValue={d.deliverables} maxLength={500} aria-invalid={!!errors.deliverables} />
        </Field>
        <ChoiceChips name="contentTypes" legend="Content types" options={UGC_CONTENT_TYPES} defaultValue={d.contentTypes ?? []} error={errors.contentTypes} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product (optional)" htmlFor="productId" error={errors.productId}>
            <NativeSelect id="productId" name="productId" defaultValue={d.productId ?? ""}>
              <option value="">No specific product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <label className="flex items-start gap-2 self-end rounded-lg border p-3 text-sm">
            <input type="checkbox" name="productShipped" defaultChecked={d.productShipped} className="mt-0.5 size-4 accent-primary" />
            <span>We ship the product to selected creators</span>
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <h2 className="text-base font-semibold">Terms</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Fee per creator (₹)" htmlFor="feeRupees" error={errors.feeRupees} required hint="You pay each selected creator directly once you approve their content.">
            <Input id="feeRupees" name="feeRupees" type="number" inputMode="numeric" min={100} step={1} defaultValue={d.feeRupees} aria-invalid={!!errors.feeRupees} />
          </Field>
          <Field label="Creators needed" htmlFor="creatorsNeeded" error={errors.creatorsNeeded} required>
            <Input id="creatorsNeeded" name="creatorsNeeded" type="number" inputMode="numeric" min={1} max={UGC_MAX_CREATORS} defaultValue={d.creatorsNeeded ?? "1"} aria-invalid={!!errors.creatorsNeeded} />
          </Field>
          <Field label="How you will use the content" htmlFor="usageRights" error={errors.usageRights} required>
            <NativeSelect id="usageRights" name="usageRights" defaultValue={d.usageRights ?? ""} aria-invalid={!!errors.usageRights}>
              <option value="" disabled>
                Choose usage rights
              </option>
              {UGC_USAGE_RIGHTS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Usage notes (optional)" htmlFor="usageNotes" error={errors.usageNotes} hint="e.g. “No whitelisting”, “Creator may post on their own page too”.">
            <Input id="usageNotes" name="usageNotes" defaultValue={d.usageNotes} maxLength={500} />
          </Field>
          <Field label="Apply by (optional)" htmlFor="applyBy" error={errors.applyBy}>
            <Input id="applyBy" name="applyBy" type="date" defaultValue={d.applyBy} />
          </Field>
          <Field label="Deliver by (optional)" htmlFor="deliverBy" error={errors.deliverBy}>
            <Input id="deliverBy" name="deliverBy" type="date" defaultValue={d.deliverBy} />
          </Field>
        </div>
        <p className="text-xs text-muted-foreground">Each collaboration includes the first delivery and up to two revision rounds.</p>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="ghost" nativeButton={false} render={<Link href={briefId ? `/dashboard/brand/ugc/${briefId}` : "/dashboard/brand/ugc"} />}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <SaveIcon aria-hidden />}
          {briefId ? "Save changes" : "Save draft"}
        </Button>
      </div>
    </form>
  );
}
