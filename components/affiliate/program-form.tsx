"use client";

import { useActionState } from "react";
import type { AffiliateProgram } from "@prisma/client";
import { adminSaveAffiliateProgramAction, saveAffiliateProgramAction } from "@/app/actions/affiliate";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/forms/field";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { ImageUpload } from "@/components/uploads/image-upload";
import { AFFILIATE_CATEGORIES, AFFILIATE_PROGRAM_TYPES, BEST_FOR_OPTIONS, PROGRAM_TYPE_LABEL } from "@/lib/validation/affiliate";

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
 * are required, because many programmes publish nothing else — and anything left
 * empty is shown as "not stated", never filled with a default.
 *
 * `mode="admin"` adds the brand (a Refnivo account, or just a name for a
 * programme listed from public information) and saves through the admin action.
 */
export function AffiliateProgramForm({
  program,
  mode = "brand",
  brands = [],
  uploadsEnabled = false,
}: {
  program?: AffiliateProgram | null;
  mode?: "brand" | "admin";
  brands?: { id: string; name: string }[];
  /** Admin: whether image uploads are available on this deployment. */
  uploadsEnabled?: boolean;
}) {
  const [state, action] = useActionState(mode === "admin" ? adminSaveAffiliateProgramAction : saveAffiliateProgramAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const attempt = useFormAttempt(state);
  const v = (key: keyof AffiliateProgram & string) => values[key] ?? (program?.[key] == null ? "" : String(program[key]));
  const live = mode === "brand" && program?.status === "APPROVED";

  return (
    <form key={attempt} action={action} className="space-y-8" noValidate>
      {program ? <input type="hidden" name="id" value={program.id} /> : null}
      <FormError message={state && !state.ok ? state.error : null} />
      {live ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          This listing is live. Saving changes takes it off the marketplace until Refnivo reviews it again.
        </p>
      ) : null}
      {mode === "admin" && program?.verifiedAt ? (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          This listing is marked verified. Saving with “Verified” ticked re-checks the official program URL; a broken URL can&apos;t stay verified.
        </p>
      ) : null}

      {mode === "admin" ? (
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold">Brand</legend>
          <p className="text-sm text-muted-foreground">
            Attach the listing to the brand&apos;s Refnivo account if it has one. Otherwise enter the brand&apos;s name: the listing is then shown as &quot;Listed by
            Refnivo&quot; and states that the brand has not joined.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Brand on Refnivo" htmlFor="brandId" error={errors.brandId}>
              <NativeSelect id="brandId" name="brandId" defaultValue={v("brandId")}>
                <option value="">Not on Refnivo</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Brand name" htmlFor="brandName" error={errors.brandName} hint="Only used when the brand is not on Refnivo.">
              <Input id="brandName" name="brandName" defaultValue={v("brandName")} placeholder="e.g. boAt" />
            </Field>
          </div>
        </fieldset>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Basic information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Programme name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" defaultValue={v("name")} placeholder="e.g. boAt Affiliate Program" required aria-invalid={!!errors.name} />
          </Field>
          <Field label="Program type" htmlFor="programType" error={errors.programType} required hint="How the programme itself describes it — a customer referral scheme is “Referral”.">
            <NativeSelect id="programType" name="programType" defaultValue={v("programType") || "AFFILIATE"}>
              {AFFILIATE_PROGRAM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PROGRAM_TYPE_LABEL[t]}
                </option>
              ))}
            </NativeSelect>
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
          <Field label="Subcategory" htmlFor="subcategory" error={errors.subcategory} hint="Optional, e.g. Audio & Wearables, Skincare.">
            <Input id="subcategory" name="subcategory" defaultValue={v("subcategory")} />
          </Field>
          <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={4} defaultValue={v("description")} placeholder="What creators promote and who the programme suits." />
          </Field>
          <Field label="Affiliate signup URL" htmlFor="signupUrl" error={errors.signupUrl} required hint="The official signup page — the brand's own, or its authorised affiliate network's. Refnivo sends creators straight here." className="sm:col-span-2">
            <Input id="signupUrl" name="signupUrl" type="url" defaultValue={v("signupUrl")} placeholder="https://…" required aria-invalid={!!errors.signupUrl} />
          </Field>
          <Field label="Programme page URL" htmlFor="programUrl" error={errors.programUrl} hint="Terms or overview page, if you have one.">
            <Input id="programUrl" name="programUrl" type="url" defaultValue={v("programUrl")} placeholder="https://…" />
          </Field>
          <Field label="Brand website" htmlFor="websiteUrl" error={errors.websiteUrl}>
            <Input id="websiteUrl" name="websiteUrl" type="url" defaultValue={v("websiteUrl")} placeholder="https://…" />
          </Field>
          {mode === "admin" ? (
            <div className="space-y-3 sm:col-span-2">
              <ImageUpload
                name="logoUpload"
                endpoint="/api/uploads/program-logo"
                initialUrl={null}
                label="Upload logo"
                aspect="aspect-square max-w-32"
                disabled={!uploadsEnabled}
                helpText="Square PNG or WebP of the official logo. Replaces the path below when uploaded."
              />
              <Field label="Logo path or URL" htmlFor="logoUrl" error={errors.logoUrl} hint="e.g. /brand-logos/boat.png, or an uploaded image URL.">
                <Input id="logoUrl" name="logoUrl" defaultValue={v("logoUrl")} placeholder="/brand-logos/…" />
              </Field>
            </div>
          ) : (
            <Field label="Logo URL" htmlFor="logoUrl" error={errors.logoUrl} hint="Optional — your brand logo is used if empty.">
              <Input id="logoUrl" name="logoUrl" defaultValue={v("logoUrl")} placeholder="https://…" />
            </Field>
          )}
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="text-base font-semibold">Affiliate terms</legend>
        <p className="text-sm text-muted-foreground">
          {mode === "admin"
            ? "Fill in only what the programme publishes. Leave the rest empty or “Not stated” — creators then see that it is not published."
            : "Describe your external programme as it actually is. Refnivo shows this as your statement — it does not pay or guarantee it."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Commission type" htmlFor="commissionType" error={errors.commissionType}>
            <NativeSelect id="commissionType" name="commissionType" defaultValue={v("commissionType")}>
              <option value="">Not stated</option>
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
          <Field label="How creators are admitted" htmlFor="approvalType" error={errors.approvalType}>
            <NativeSelect id="approvalType" name="approvalType" defaultValue={v("approvalType")}>
              <option value="">Not stated</option>
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
          <Field
            label="Eligibility"
            htmlFor="requirements"
            error={errors.requirements}
            className="sm:col-span-2"
            hint="Only what the programme states (follower minimum, website required…). Empty shows “Open application / subject to program approval”."
          >
            <Textarea id="requirements" name="requirements" rows={3} defaultValue={v("requirements")} />
          </Field>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Best for</p>
            <div className="flex flex-wrap gap-3">
              {BEST_FOR_OPTIONS.map((b) => (
                <label key={b} className="inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" name="bestFor" value={b} defaultChecked={program?.bestFor.includes(b)} className="size-4 accent-primary" />
                  {b}
                </label>
              ))}
            </div>
          </div>
        </div>
      </fieldset>

      {mode === "admin" ? (
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold">Verification & visibility</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Source URL" htmlFor="sourceUrl" error={errors.sourceUrl} hint="The official page the facts above were checked against." className="sm:col-span-2">
              <Input id="sourceUrl" name="sourceUrl" type="url" defaultValue={v("sourceUrl")} placeholder="https://…" />
            </Field>
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="verified" defaultChecked={!!program?.verifiedAt} className="mt-0.5 size-4 accent-primary" />
              <span>
                <span className="font-medium">Verified</span> — I checked the brand, the official programme page and every fact above. The official program URL is
                re-checked on save; a broken URL is refused.
              </span>
            </label>
            <Field label="Verification date" htmlFor="verifiedOn" error={errors.verifiedOn} hint="Defaults to today (or the existing date) when left empty.">
              <Input id="verifiedOn" name="verifiedOn" type="date" defaultValue={program?.verifiedAt ? program.verifiedAt.toISOString().slice(0, 10) : ""} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="featured" defaultChecked={!!program?.featured} className="size-4 accent-primary" />
              <span className="font-medium">Featured</span> <span className="text-muted-foreground">(pinned first — not a ranking)</span>
            </label>
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
        {mode === "admin" ? (
          <Button type="submit">{program ? "Save changes" : "Add to review queue"}</Button>
        ) : (
          <>
            <Button type="submit" name="intent" value="draft" variant="outline">
              Save draft
            </Button>
            <Button type="submit" name="intent" value="submit">
              Submit for review
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
