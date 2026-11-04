"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/forms/field";
import { ImageUpload } from "@/components/uploads/image-upload";
import { ChoiceChips, FormSection, LocationFields, arr, opt, str, type Errors, type Values } from "@/components/onboarding/form-kit";
import { CUSTOMER_INTEREST_OPTIONS, GENDER_OPTIONS, PRODUCT_CATEGORY_OPTIONS } from "@/lib/onboarding/options";

/** Customer profile fields — "Create Your Customer Profile" (onboarding) and Profile (edit). Private: no public page. */
export function CustomerFields({ values, errors, uploadsEnabled, email }: { values: Values; errors: Errors; uploadsEnabled: boolean; email: string }) {
  const v = (key: string) => str(values, key);
  return (
    <>
      <FormSection title="About you" description="Your profile is private — it personalises what you see on Refnivo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="name" error={errors.name} required>
            <Input id="name" name="name" autoComplete="name" defaultValue={v("name")} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Username" htmlFor="username" error={errors.username} hint="3–30 characters: letters, numbers and underscores." required>
            <Input id="username" name="username" autoCapitalize="none" autoComplete="username" spellCheck={false} defaultValue={v("username")} aria-invalid={!!errors.username} />
          </Field>
          <Field label="Email address" htmlFor="email" hint="Your sign-in e-mail. Contact support to change it." required>
            <Input id="email" type="email" value={email} readOnly aria-readonly className="bg-muted/50 text-muted-foreground" />
          </Field>
          <Field label={opt("Profile picture")} htmlFor="avatarUrl" error={errors.avatarUrl}>
            <ImageUpload name="avatarUrl" endpoint="/api/uploads/avatar" initialUrl={v("avatarUrl") || undefined} label="Upload photo" aspect="aspect-square max-w-32" disabled={!uploadsEnabled} />
          </Field>
          <Field label={opt("Short bio")} htmlFor="bio" error={errors.bio} className="sm:col-span-2">
            <Textarea id="bio" name="bio" rows={2} defaultValue={v("bio")} placeholder="A line about you and what you like to shop for." aria-invalid={!!errors.bio} />
          </Field>
          <Field label={opt("Gender")} htmlFor="gender" error={errors.gender}>
            <NativeSelect id="gender" name="gender" defaultValue={v("gender")}>
              <option value="">Select</option>
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </FormSection>

      <FormSection title="Location">
        <LocationFields values={values} errors={errors} countryRequired />
      </FormSection>

      <FormSection title="Interests" description="So we can show you brands and products you'll like.">
        <ChoiceChips name="interests" legend={opt("Interests")} options={CUSTOMER_INTEREST_OPTIONS} defaultValue={arr(values, "interests")} error={errors.interests} />
        <ChoiceChips name="preferredCategories" legend={opt("Preferred product categories")} options={PRODUCT_CATEGORY_OPTIONS} defaultValue={arr(values, "preferredCategories")} error={errors.preferredCategories} />
        <Field label={opt("Favourite brands")} htmlFor="favouriteBrands" error={errors.favouriteBrands}>
          <Input id="favouriteBrands" name="favouriteBrands" defaultValue={v("favouriteBrands")} placeholder="e.g. boAt, Mamaearth, Bewakoof" aria-invalid={!!errors.favouriteBrands} />
        </Field>
      </FormSection>
    </>
  );
}
