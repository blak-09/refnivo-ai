"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import type { Brand } from "@prisma/client";
import { createBrandAction, updateBrandAction } from "@/app/actions/brand";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { ImageUpload } from "@/components/uploads/image-upload";
import { BRAND_INDUSTRIES } from "@/lib/utils/labels";
import type { BrandSocialLinks } from "@/lib/validation/brand";

type Props = ({ mode: "create" } | { mode: "edit"; brand: Brand }) & { uploadsEnabled?: boolean };

export function BrandForm(props: Props) {
  const uploadsEnabled = props.uploadsEnabled ?? true;
  const action = props.mode === "create" ? createBrandAction : updateBrandAction;
  const [state, formAction] = useActionState(action, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const b = props.mode === "edit" ? props.brand : null;
  const social = (b?.socialLinks ?? {}) as BrandSocialLinks;
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  const dv = (key: string, fallback: string | null | undefined) => values[key] ?? (fallback ?? "");

  React.useEffect(() => {
    if (state?.ok && props.mode === "edit") toast.success("Brand profile saved.");
  }, [state, props.mode]);

  return (
    <form key={attempt} action={formAction} className="space-y-6" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand name" htmlFor="name" error={errors.name} required>
          <Input id="name" name="name" defaultValue={dv("name", b?.name)} placeholder="boAt" required aria-invalid={!!errors.name} />
        </Field>
        <Field label="Industry / category" htmlFor="industry" error={errors.industry}>
          <NativeSelect id="industry" name="industry" defaultValue={dv("industry", b?.industry)}>
            <option value="">Select industry</option>
            {BRAND_INDUSTRIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </Field>

        <Field label="Tagline" htmlFor="tagline" error={errors.tagline} className="sm:col-span-2" hint="One line shown on your public brand card.">
          <Input id="tagline" name="tagline" defaultValue={dv("tagline", b?.tagline)} placeholder="Plug into Nirvana" />
        </Field>

        <Field label="Description" htmlFor="description" error={errors.description} className="sm:col-span-2" hint="Shown on your public brand profile to creators and customers.">
          <Textarea id="description" name="description" rows={4} defaultValue={dv("description", b?.description)} placeholder="India's #1 audio brand — headphones, earbuds and speakers built for everyday listening." />
        </Field>

        <Field label="Website" htmlFor="website" error={errors.website}>
          <Input id="website" name="website" type="url" defaultValue={dv("website", b?.website)} placeholder="https://www.boat-lifestyle.com" aria-invalid={!!errors.website} />
        </Field>
        <Field label="Support email" htmlFor="supportEmail" error={errors.supportEmail}>
          <Input id="supportEmail" name="supportEmail" type="email" defaultValue={dv("supportEmail", b?.supportEmail)} placeholder="partners@brand.com" aria-invalid={!!errors.supportEmail} />
        </Field>

        <Field label="Brand logo" htmlFor="logoUrl" error={errors.logoUrl} hint="Square works best. Shown next to your name on campaigns and referral pages.">
          <ImageUpload name="logoUrl" endpoint="/api/uploads/brand-logo" initialUrl={dv("logoUrl", b?.logoUrl) || undefined} label="Upload logo" aspect="aspect-square max-w-48" disabled={!uploadsEnabled} />
        </Field>
        <Field label="Cover image" htmlFor="coverImageUrl" error={errors.coverImageUrl} hint="Wide banner for your public brand page.">
          <ImageUpload name="coverImageUrl" endpoint="/api/uploads/brand-cover" initialUrl={dv("coverImageUrl", b?.coverImageUrl) || undefined} label="Upload cover image" disabled={!uploadsEnabled} />
        </Field>

        <Field label="Country" htmlFor="country" error={errors.country}>
          <Input id="country" name="country" defaultValue={dv("country", b?.country ?? "India")} />
        </Field>
      </div>

      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold">Social media</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instagram URL" htmlFor="instagramUrl" error={errors.instagramUrl}>
            <Input id="instagramUrl" name="instagramUrl" type="url" defaultValue={dv("instagramUrl", social.instagram)} placeholder="https://instagram.com/…" aria-invalid={!!errors.instagramUrl} />
          </Field>
          <Field label="YouTube URL" htmlFor="youtubeUrl" error={errors.youtubeUrl}>
            <Input id="youtubeUrl" name="youtubeUrl" type="url" defaultValue={dv("youtubeUrl", social.youtube)} placeholder="https://youtube.com/@…" aria-invalid={!!errors.youtubeUrl} />
          </Field>
          <Field label="X / Twitter URL" htmlFor="twitterUrl" error={errors.twitterUrl}>
            <Input id="twitterUrl" name="twitterUrl" type="url" defaultValue={dv("twitterUrl", social.twitter)} placeholder="https://x.com/…" aria-invalid={!!errors.twitterUrl} />
          </Field>
          <Field label="Facebook URL" htmlFor="facebookUrl" error={errors.facebookUrl}>
            <Input id="facebookUrl" name="facebookUrl" type="url" defaultValue={dv("facebookUrl", social.facebook)} placeholder="https://facebook.com/…" aria-invalid={!!errors.facebookUrl} />
          </Field>
          <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={errors.linkedinUrl}>
            <Input id="linkedinUrl" name="linkedinUrl" type="url" defaultValue={dv("linkedinUrl", social.linkedin)} placeholder="https://linkedin.com/company/…" aria-invalid={!!errors.linkedinUrl} />
          </Field>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingText={props.mode === "create" ? "Creating…" : "Saving…"}>
          {props.mode === "create" ? "Create brand & continue" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
