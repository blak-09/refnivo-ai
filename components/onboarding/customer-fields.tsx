"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/forms/field";
import { ImageUpload } from "@/components/uploads/image-upload";
import { ChoiceChips, FormSection, LocationFields, MoreDetails, arr, opt, str, type Errors, type Values } from "@/components/onboarding/form-kit";
import { CUSTOMER_INTEREST_OPTIONS, GENDER_OPTIONS, PRODUCT_CATEGORY_OPTIONS } from "@/lib/onboarding/options";

const MORE_KEYS = ["avatarUrl", "bio", "gender", "interests", "favouriteBrands"] as const;

/**
 * Customer profile fields — "Create Your Customer Profile" (onboarding) and Profile (edit).
 * Private: no public page. Essentials first (name, username, location, product interests);
 * the rest sits in "More details", collapsed during onboarding.
 */
export function CustomerFields({ values, errors, uploadsEnabled, email, mode }: { values: Values; errors: Errors; uploadsEnabled: boolean; email: string; mode: "onboarding" | "edit" }) {
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
          <Field label="Email address" htmlFor="email" hint="Your sign-in e-mail. Contact support to change it." className="sm:col-span-2">
            <Input id="email" type="email" value={email} readOnly aria-readonly className="bg-muted/50 text-muted-foreground" />
          </Field>
        </div>
        <LocationFields values={values} errors={errors} countryRequired />
      </FormSection>

      <FormSection title="What you shop for" description="So we can show you products you'll like and want to share.">
        <ChoiceChips name="preferredCategories" legend={opt("Product categories")} options={PRODUCT_CATEGORY_OPTIONS} defaultValue={arr(values, "preferredCategories")} error={errors.preferredCategories} />
      </FormSection>

      <MoreDetails keys={MORE_KEYS} values={values} errors={errors} defaultOpen={mode === "edit"} description="A photo, a short bio, interests and favourite brands. Add them now or later from your profile.">
        <FormSection title="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={opt("Profile picture")} htmlFor="avatarUrl" error={errors.avatarUrl}>
              <ImageUpload name="avatarUrl" endpoint="/api/uploads/avatar" initialUrl={v("avatarUrl") || undefined} label="Upload photo" aspect="aspect-square max-w-32" disabled={!uploadsEnabled} />
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
            <Field label={opt("Short bio")} htmlFor="bio" error={errors.bio} className="sm:col-span-2">
              <Textarea id="bio" name="bio" rows={2} defaultValue={v("bio")} placeholder="A line about you and what you like to shop for." aria-invalid={!!errors.bio} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Interests">
          <ChoiceChips name="interests" legend={opt("Interests")} options={CUSTOMER_INTEREST_OPTIONS} defaultValue={arr(values, "interests")} error={errors.interests} />
          <Field label={opt("Favourite brands")} htmlFor="favouriteBrands" error={errors.favouriteBrands}>
            <Input id="favouriteBrands" name="favouriteBrands" defaultValue={v("favouriteBrands")} placeholder="e.g. your go-to brands, separated by commas" aria-invalid={!!errors.favouriteBrands} />
          </Field>
        </FormSection>
      </MoreDetails>
    </>
  );
}
