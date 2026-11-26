"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/forms/field";
import { ImageUpload } from "@/components/uploads/image-upload";
import { ChoiceChips, FormSection, LocationFields, MoreDetails, arr, opt, str, type Errors, type Values } from "@/components/onboarding/form-kit";
import { BRAND_COLLABORATION_OPTIONS, BRAND_INDUSTRIES, PRODUCT_CATEGORY_OPTIONS } from "@/lib/onboarding/options";

const MORE_KEYS = [
  "coverImageUrl",
  "productCategories",
  "productDescription",
  "targetAudience",
  "instagramUrl",
  "facebookUrl",
  "linkedinUrl",
  "youtubeUrl",
  "twitterUrl",
  "collaborationTypes",
  "tagline",
  "supportEmail",
] as const;

/**
 * Brand profile fields — "Build Your Brand Profile" (onboarding) and Brand Profile (edit).
 * Essentials first (name, category, logo, description, website, location, contact);
 * everything else sits in "More details", collapsed during onboarding.
 */
export function BrandFields({ values, errors, uploadsEnabled, mode }: { values: Values; errors: Errors; uploadsEnabled: boolean; mode: "onboarding" | "edit" }) {
  const v = (key: string) => str(values, key);
  return (
    <>
      <FormSection title="Your brand" description="What creators and customers see first.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" defaultValue={v("name")} placeholder="e.g. Soundwave Audio" autoComplete="organization" aria-invalid={!!errors.name} />
          </Field>
          <Field label="Business category" htmlFor="industry" error={errors.industry} required>
            <NativeSelect id="industry" name="industry" defaultValue={v("industry")} aria-invalid={!!errors.industry}>
              <option value="">Select a category</option>
              {BRAND_INDUSTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={opt("Brand logo")} htmlFor="logoUrl" error={errors.logoUrl} hint="Square works best. Shown on campaigns and referral pages.">
            <ImageUpload id="logoUrl" invalid={!!errors.logoUrl} name="logoUrl" endpoint="/api/uploads/brand-logo" initialUrl={v("logoUrl") || undefined} label="Upload logo" aspect="aspect-square max-w-40" disabled={!uploadsEnabled} />
          </Field>
          <Field label={opt("Website")} htmlFor="website" error={errors.website} hint="Where shoppers buy your products.">
            <Input id="website" name="website" type="url" inputMode="url" defaultValue={v("website")} placeholder="https://yourbrand.com" aria-invalid={!!errors.website} />
          </Field>
          <Field label="Short brand description" htmlFor="description" error={errors.description} className="sm:col-span-2" hint="A few sentences: who you are and what you sell (at least 20 characters)." required>
            <Textarea id="description" name="description" rows={3} defaultValue={v("description")} placeholder="We make everyday audio gear — earbuds, headphones and speakers — designed in India." aria-invalid={!!errors.description} />
          </Field>
        </div>
        <LocationFields values={values} errors={errors} />
      </FormSection>

      <FormSection title="Contact" description="Used by Refnivo to reach you. Not shown publicly.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business email" htmlFor="businessEmail" error={errors.businessEmail} required>
            <Input id="businessEmail" name="businessEmail" type="email" autoComplete="email" defaultValue={v("businessEmail")} placeholder="partners@yourbrand.com" aria-invalid={!!errors.businessEmail} />
          </Field>
          <Field label="Contact person name" htmlFor="contactName" error={errors.contactName} required>
            <Input id="contactName" name="contactName" autoComplete="name" defaultValue={v("contactName")} aria-invalid={!!errors.contactName} />
          </Field>
        </div>
      </FormSection>

      <MoreDetails keys={MORE_KEYS} values={values} errors={errors} defaultOpen={mode === "edit"} description="Products, audience, social links and a cover image. Add them now or later from Brand Profile.">
        <FormSection title="Products & audience" description="Helps creators decide if your brand is a fit.">
          <ChoiceChips name="productCategories" legend={opt("Product categories")} options={PRODUCT_CATEGORY_OPTIONS} defaultValue={arr(values, "productCategories")} error={errors.productCategories} />
          <Field label={opt("Brand / product description")} htmlFor="productDescription" error={errors.productDescription} hint="Your main products, price range, what makes them different.">
            <Textarea id="productDescription" name="productDescription" rows={3} defaultValue={v("productDescription")} aria-invalid={!!errors.productDescription} />
          </Field>
          <Field label={opt("Target audience")} htmlFor="targetAudience" error={errors.targetAudience}>
            <Input id="targetAudience" name="targetAudience" defaultValue={v("targetAudience")} placeholder="e.g. College students and young professionals in metro cities" aria-invalid={!!errors.targetAudience} />
          </Field>
        </FormSection>

        <FormSection title="Social links" description="All optional — skip any you don't use.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={opt("Instagram URL")} htmlFor="instagramUrl" error={errors.instagramUrl}>
              <Input id="instagramUrl" name="instagramUrl" type="url" inputMode="url" defaultValue={v("instagramUrl")} placeholder="https://instagram.com/yourbrand" aria-invalid={!!errors.instagramUrl} />
            </Field>
            <Field label={opt("Facebook URL")} htmlFor="facebookUrl" error={errors.facebookUrl}>
              <Input id="facebookUrl" name="facebookUrl" type="url" inputMode="url" defaultValue={v("facebookUrl")} placeholder="https://facebook.com/yourbrand" aria-invalid={!!errors.facebookUrl} />
            </Field>
            <Field label={opt("LinkedIn URL")} htmlFor="linkedinUrl" error={errors.linkedinUrl}>
              <Input id="linkedinUrl" name="linkedinUrl" type="url" inputMode="url" defaultValue={v("linkedinUrl")} placeholder="https://linkedin.com/company/yourbrand" aria-invalid={!!errors.linkedinUrl} />
            </Field>
            <Field label={opt("YouTube URL")} htmlFor="youtubeUrl" error={errors.youtubeUrl}>
              <Input id="youtubeUrl" name="youtubeUrl" type="url" inputMode="url" defaultValue={v("youtubeUrl")} placeholder="https://youtube.com/@yourbrand" aria-invalid={!!errors.youtubeUrl} />
            </Field>
            {mode === "edit" ? (
              <Field label={opt("X / Twitter URL")} htmlFor="twitterUrl" error={errors.twitterUrl}>
                <Input id="twitterUrl" name="twitterUrl" type="url" inputMode="url" defaultValue={v("twitterUrl")} placeholder="https://x.com/yourbrand" aria-invalid={!!errors.twitterUrl} />
              </Field>
            ) : null}
          </div>
        </FormSection>

        <FormSection title="Cover & collaboration">
          <Field label={opt("Cover image")} htmlFor="coverImageUrl" error={errors.coverImageUrl} hint="A wide banner for your public brand page.">
            <ImageUpload id="coverImageUrl" invalid={!!errors.coverImageUrl} name="coverImageUrl" endpoint="/api/uploads/brand-cover" initialUrl={v("coverImageUrl") || undefined} label="Upload cover" disabled={!uploadsEnabled} />
          </Field>
          <ChoiceChips name="collaborationTypes" legend={opt("Preferred collaboration types")} options={BRAND_COLLABORATION_OPTIONS} defaultValue={arr(values, "collaborationTypes")} error={errors.collaborationTypes} />
        </FormSection>

        {mode === "edit" ? (
          <FormSection title="Public details" description="Shown on your public brand card and page.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={opt("Tagline")} htmlFor="tagline" error={errors.tagline} className="sm:col-span-2" hint="One line under your name.">
                <Input id="tagline" name="tagline" defaultValue={v("tagline")} aria-invalid={!!errors.tagline} />
              </Field>
              <Field label={opt("Public support email")} htmlFor="supportEmail" error={errors.supportEmail}>
                <Input id="supportEmail" name="supportEmail" type="email" defaultValue={v("supportEmail")} aria-invalid={!!errors.supportEmail} />
              </Field>
            </div>
          </FormSection>
        ) : null}
      </MoreDetails>
    </>
  );
}
