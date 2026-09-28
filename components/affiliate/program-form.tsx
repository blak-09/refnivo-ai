"use client";

import { useActionState } from "react";
import type { AffiliateProgram } from "@prisma/client";
import { saveAffiliateProgramAction } from "@/app/actions/affiliate";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/forms/field";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { AFFILIATE_CATEGORIES } from "@/lib/validation/affiliate";

const PLATFORMS = [
  ["INSTAGRAM", "Instagram"],
  ["YOUTUBE", "YouTube"],
  ["FACEBOOK", "Facebook"],
  ["LINKEDIN", "LinkedIn"],
  ["X", "X"],
] as const;

/**
 * Listing form for an affiliate programme the brand already runs elsewhere.
 *
 * Deliberately absent: any Refnivo commission, reward, budget or payout field.
 * Those belong to Refnivo campaigns. Here the brand only DESCRIBES its external
 * programme's terms and gives the official URLs; only the name and signup URL
 * are required, because many programmes publish nothing else.
 */
export function AffiliateProgramForm({ program }: { program?: AffiliateProgram | null }) {
  const [state, action] = useActionState(saveAffiliateProgramAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const attempt = useFormAttempt(state);
  const v = (key: keyof AffiliateProgram & string) => values[key] ?? (program?.[key] == null ? "" : String(program[key]));
  const live = program?.status === "APPROVED";

  return (
    <form key={attempt} action={action} className="space-y-8" noValidate>
      {program ? <input type="hidden" name="id" value={program.id} /> : null}
      <FormError message={state && !state.ok ? state.error : null} />
      {live ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          This listing is live. Saving changes takes it off the marketplace until Refnivo reviews it again.
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Basic information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Programme name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" defaultValue={v("name")} placeholder="e.g. boAt Affiliate Program" required aria-invalid={!!errors.name} />
          </Field>
          <Field label="Category" htmlFor="category" error={errors.category}>
            <NativeSelect id="category" name="category" defaultValue={v("category")}>
              <option value="">Choose a category</option>
              {AFFILIATE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={4} defaultValue={v("description")} placeholder="What creators promote and who the programme suits." />
          </Field>
          <Field label="Affiliate signup URL" htmlFor="signupUrl" error={errors.signupUrl} required hint="Where a creator applies or signs up. Refnivo sends creators straight here." className="sm:col-span-2">
            <Input id="signupUrl" name="signupUrl" type="url" defaultValue={v("signupUrl")} placeholder="https://…" required aria-invalid={!!errors.signupUrl} />
          </Field>
          <Field label="Programme page URL" htmlFor="programUrl" error={errors.programUrl} hint="Terms or overview page, if you have one.">
            <Input id="programUrl" name="programUrl" type="url" defaultValue={v("programUrl")} placeholder="https://…" />
          </Field>
          <Field label="Brand website" htmlFor="websiteUrl" error={errors.websiteUrl}>
            <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={v("websiteUrl")} placeholder="https://…" />
          </Field>
          <Field label="Logo URL" htmlFor="logoUrl" error={errors.logoUrl} hint="Optional — your brand logo is used if empty.">
            <Input id="logoUrl" name="logoUrl" defaultValue={v("logoUrl")} placeholder="https://…" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Affiliate terms</legend>
        <p className="text-sm text-muted-foreground">Describe your external programme as it actually is. Refnivo shows this as your statement — it does not pay or guarantee it.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Commission type" htmlFor="commissionType" error={errors.commissionType} required>
            <NativeSelect id="commissionType" name="commissionType" defaultValue={v("commissionType") || "VARIES"}>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED">Fixed amount</option>
              <option value="VARIES">Varies by product</option>
            </NativeSelect>
          </Field>
          <Field label="Commission, in your words" htmlFor="commissionDescription" error={errors.commissionDescription} hint="e.g. “Up to 8% on headphones”. Leave empty if it varies too much to summarise.">
            <Input id="commissionDescription" name="commissionDescription" defaultValue={v("commissionDescription")} />
          </Field>
          <Field label="Cookie / attribution window (days)" htmlFor="cookieDurationDays" error={errors.cookieDurationDays} hint="Only if your network publishes one.">
            <Input id="cookieDurationDays" name="cookieDurationDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={v("cookieDurationDays")} />
          </Field>
          <Field label="Affiliate network" htmlFor="networkName" error={errors.networkName} hint="Impact, Amazon Associates, Admitad, in-house…">
            <Input id="networkName" name="networkName" defaultValue={v("networkName")} />
          </Field>
          <Field label="How creators are admitted" htmlFor="approvalType" error={errors.approvalType} required>
            <NativeSelect id="approvalType" name="approvalType" defaultValue={v("approvalType") || "APPLICATION"}>
              <option value="AUTOMATIC">Automatic approval</option>
              <option value="APPLICATION">Application required</option>
              <option value="INVITE_ONLY">Invite only</option>
            </NativeSelect>
          </Field>
          <Field
            label="Sub-ID parameter (advanced)"
            htmlFor="subIdParam"
            error={errors.subIdParam}
            hint="Only if your network documents one (e.g. subId, aff_sub). Refnivo then tags each click so sales can be matched later. Leave empty if unsure."
          >
            <Input id="subIdParam" name="subIdParam" defaultValue={v("subIdParam")} placeholder="aff_sub" />
          </Field>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Creator requirements (optional)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Minimum followers" htmlFor="minFollowers" error={errors.minFollowers}>
            <Input id="minFollowers" name="minFollowers" type="number" inputMode="numeric" min={0} defaultValue={v("minFollowers")} />
          </Field>
          <Field label="Region" htmlFor="geography" error={errors.geography}>
            <Input id="geography" name="geography" defaultValue={v("geography")} placeholder="e.g. India" />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Platforms you work with</p>
            <div className="flex flex-wrap gap-3">
              {PLATFORMS.map(([value, label]) => (
                <label key={value} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="supportedPlatforms" value={value} defaultChecked={program?.supportedPlatforms.includes(value)} className="size-4 accent-primary" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <Field label="Other requirements" htmlFor="requirements" error={errors.requirements} className="sm:col-span-2">
            <Textarea id="requirements" name="requirements" rows={3} defaultValue={v("requirements")} />
          </Field>
        </div>
      </fieldset>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        <Button type="submit" name="intent" value="draft" variant="outline">
          Save draft
        </Button>
        <Button type="submit" name="intent" value="submit">
          Submit for review
        </Button>
      </div>
    </form>
  );
}
