"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field } from "@/components/forms/field";
import { ImageUpload } from "@/components/uploads/image-upload";
import { ChoiceChips, FormSection, LocationFields, MoreDetails, arr, opt, str, type Errors, type Values } from "@/components/onboarding/form-kit";
import {
  AUDIENCE_SIZE_OPTIONS,
  CONTENT_LANGUAGE_OPTIONS,
  CREATOR_CATEGORIES,
  CREATOR_COLLABORATION_OPTIONS,
  PRIMARY_PLATFORM_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
} from "@/lib/onboarding/options";
import { AUDIENCE_CATEGORIES } from "@/lib/utils/labels";

function Options({ list, current, placeholder }: { list: readonly string[]; current: string; placeholder: string }) {
  return (
    <>
      <option value="">{placeholder}</option>
      {/* Keep a stored value that is no longer in the list selectable. */}
      {current && !list.includes(current) ? <option value={current}>{current}</option> : null}
      {list.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </>
  );
}

const MORE_KEYS = [
  "linkedinUrl",
  "facebookUrl",
  "otherLinks",
  "primaryPlatform",
  "contentLanguage",
  "contentDescription",
  "country",
  "state",
  "city",
  "collaborationPreferences",
  "interestedCategories",
  "instagramHandle",
  "instagramFollowers",
  "youtubeChannel",
  "youtubeSubscribers",
  "twitterHandle",
  "twitterUrl",
  "averageViews",
  "engagementRate",
  "audienceCategory",
  "audienceLocation",
  "previousCampaigns",
  "contentSamples",
] as const;

/**
 * Creator profile fields — "Create Your Creator Profile" (onboarding) and Profile (edit).
 * Essentials first (who you are, main socials, audience size); the rest sits in
 * "More details", collapsed during onboarding.
 */
export function CreatorFields({
  values,
  errors,
  uploadsEnabled,
  mode,
  photoRequired,
}: {
  values: Values;
  errors: Errors;
  uploadsEnabled: boolean;
  mode: "onboarding" | "edit";
  photoRequired: boolean;
}) {
  const v = (key: string) => str(values, key);
  return (
    <>
      <FormSection title="About you" description="Brands see this when you apply to their campaigns.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="displayName" error={errors.displayName} required>
            <Input id="displayName" name="displayName" autoComplete="name" defaultValue={v("displayName")} aria-invalid={!!errors.displayName} />
          </Field>
          <Field label="Username" htmlFor="username" error={errors.username} hint="Your public link: refnivo.com/creators/username" required>
            <Input id="username" name="username" autoCapitalize="none" autoComplete="username" spellCheck={false} defaultValue={v("username")} placeholder="yourname" aria-invalid={!!errors.username} />
          </Field>
          <Field label={photoRequired ? "Profile picture" : opt("Profile picture")} htmlFor="profileImageUrl" error={errors.profileImageUrl} required={photoRequired} hint="A clear photo of you or your channel logo.">
            <ImageUpload id="profileImageUrl" invalid={!!errors.profileImageUrl} name="profileImageUrl" endpoint="/api/uploads/creator-image" initialUrl={v("profileImageUrl") || undefined} label="Upload photo" aspect="aspect-square max-w-40" disabled={!uploadsEnabled} />
          </Field>
          <Field label="Creator category" htmlFor="category" error={errors.category} required>
            <NativeSelect id="category" name="category" defaultValue={v("category")} aria-invalid={!!errors.category}>
              <Options list={CREATOR_CATEGORIES} current={v("category")} placeholder="Select a category" />
            </NativeSelect>
          </Field>
          <Field label="Professional bio" htmlFor="bio" error={errors.bio} className="sm:col-span-2" hint="At least 40 characters: who you are, what you create and for whom. Brands read this before approving you." required>
            <Textarea id="bio" name="bio" rows={4} defaultValue={v("bio")} placeholder="Honest gadget reviews for students and first-jobbers. Two videos a week." aria-invalid={!!errors.bio} />
          </Field>
        </div>
      </FormSection>

      <FormSection title="Social profiles" description="Public profile links only — we never ask for passwords or analytics access.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={opt("Instagram profile URL")} htmlFor="instagramUrl" error={errors.instagramUrl}>
            <Input id="instagramUrl" name="instagramUrl" type="url" inputMode="url" defaultValue={v("instagramUrl")} placeholder="https://instagram.com/yourname" aria-invalid={!!errors.instagramUrl} />
          </Field>
          <Field label={opt("YouTube channel URL")} htmlFor="youtubeUrl" error={errors.youtubeUrl}>
            <Input id="youtubeUrl" name="youtubeUrl" type="url" inputMode="url" defaultValue={v("youtubeUrl")} placeholder="https://youtube.com/@yourname" aria-invalid={!!errors.youtubeUrl} />
          </Field>
          <Field label={opt("Audience size")} htmlFor="audienceSize" error={errors.audienceSize} hint="Self-reported — your total followers. Shown to brands as self-reported.">
            <NativeSelect id="audienceSize" name="audienceSize" defaultValue={v("audienceSize")}>
              <Options list={AUDIENCE_SIZE_OPTIONS} current={v("audienceSize")} placeholder="Select size" />
            </NativeSelect>
          </Field>
        </div>
      </FormSection>

      <MoreDetails keys={MORE_KEYS} values={values} errors={errors} defaultOpen={mode === "edit"} description="More social links, your content, location and the brands you want to work with. Add them now or later from your profile.">
        <FormSection title="More social links">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={opt("LinkedIn profile URL")} htmlFor="linkedinUrl" error={errors.linkedinUrl}>
              <Input id="linkedinUrl" name="linkedinUrl" type="url" inputMode="url" defaultValue={v("linkedinUrl")} placeholder="https://linkedin.com/in/yourname" aria-invalid={!!errors.linkedinUrl} />
            </Field>
            <Field label={opt("Facebook profile URL")} htmlFor="facebookUrl" error={errors.facebookUrl}>
              <Input id="facebookUrl" name="facebookUrl" type="url" inputMode="url" defaultValue={v("facebookUrl")} placeholder="https://facebook.com/yourname" aria-invalid={!!errors.facebookUrl} />
            </Field>
            <Field label={opt("Other social links")} htmlFor="otherLinks" error={errors.otherLinks} className="sm:col-span-2" hint="One link per line (up to 5) — X, Threads, Moj, a blog…">
              <Textarea id="otherLinks" name="otherLinks" rows={2} defaultValue={v("otherLinks")} aria-invalid={!!errors.otherLinks} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Your content">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={opt("Primary content platform")} htmlFor="primaryPlatform" error={errors.primaryPlatform}>
              <NativeSelect id="primaryPlatform" name="primaryPlatform" defaultValue={v("primaryPlatform")}>
                <Options list={PRIMARY_PLATFORM_OPTIONS} current={v("primaryPlatform")} placeholder="Select platform" />
              </NativeSelect>
            </Field>
            <Field label={opt("Content language")} htmlFor="contentLanguage" error={errors.contentLanguage}>
              <NativeSelect id="contentLanguage" name="contentLanguage" defaultValue={v("contentLanguage")}>
                <Options list={CONTENT_LANGUAGE_OPTIONS} current={v("contentLanguage")} placeholder="Select language" />
              </NativeSelect>
            </Field>
          </div>
          <Field label={opt("Content description")} htmlFor="contentDescription" error={errors.contentDescription} hint="Formats you make (reels, long videos, posts), topics and posting frequency.">
            <Textarea id="contentDescription" name="contentDescription" rows={3} defaultValue={v("contentDescription")} aria-invalid={!!errors.contentDescription} />
          </Field>
        </FormSection>

        <FormSection title="Location">
          <LocationFields values={values} errors={errors} />
        </FormSection>

        <FormSection title="Collaboration" description="Paid promotions must be labelled (e.g. #ad or “Paid partnership”) under ASCI guidelines.">
          <ChoiceChips
            name="collaborationPreferences"
            legend={opt("Collaboration preferences")}
            options={CREATOR_COLLABORATION_OPTIONS}
            defaultValue={arr(values, "collaborationPreferences")}
            error={errors.collaborationPreferences}
          />
          <ChoiceChips
            name="interestedCategories"
            legend={opt("Interested brand categories")}
            options={PRODUCT_CATEGORY_OPTIONS}
            defaultValue={arr(values, "interestedCategories")}
            error={errors.interestedCategories}
          />
        </FormSection>

        {mode === "edit" ? (
          <FormSection title="Audience numbers & work samples" description="All self-reported and labelled that way to brands, until a social account is connected.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={opt("Instagram handle")} htmlFor="instagramHandle" error={errors.instagramHandle}>
                <Input id="instagramHandle" name="instagramHandle" defaultValue={v("instagramHandle")} placeholder="@yourname" aria-invalid={!!errors.instagramHandle} />
              </Field>
              <Field label={opt("Instagram followers")} htmlFor="instagramFollowers" error={errors.instagramFollowers}>
                <Input id="instagramFollowers" name="instagramFollowers" type="number" inputMode="numeric" min={0} defaultValue={v("instagramFollowers")} aria-invalid={!!errors.instagramFollowers} />
              </Field>
              <Field label={opt("YouTube channel name")} htmlFor="youtubeChannel" error={errors.youtubeChannel}>
                <Input id="youtubeChannel" name="youtubeChannel" defaultValue={v("youtubeChannel")} aria-invalid={!!errors.youtubeChannel} />
              </Field>
              <Field label={opt("YouTube subscribers")} htmlFor="youtubeSubscribers" error={errors.youtubeSubscribers}>
                <Input id="youtubeSubscribers" name="youtubeSubscribers" type="number" inputMode="numeric" min={0} defaultValue={v("youtubeSubscribers")} aria-invalid={!!errors.youtubeSubscribers} />
              </Field>
              <Field label={opt("X / Twitter handle")} htmlFor="twitterHandle" error={errors.twitterHandle}>
                <Input id="twitterHandle" name="twitterHandle" defaultValue={v("twitterHandle")} aria-invalid={!!errors.twitterHandle} />
              </Field>
              <Field label={opt("X / Twitter URL")} htmlFor="twitterUrl" error={errors.twitterUrl}>
                <Input id="twitterUrl" name="twitterUrl" type="url" defaultValue={v("twitterUrl")} aria-invalid={!!errors.twitterUrl} />
              </Field>
              <Field label={opt("Average views per post")} htmlFor="averageViews" error={errors.averageViews}>
                <Input id="averageViews" name="averageViews" type="number" inputMode="numeric" min={0} defaultValue={v("averageViews")} aria-invalid={!!errors.averageViews} />
              </Field>
              <Field label={opt("Engagement rate (%)")} htmlFor="engagementRate" error={errors.engagementRate}>
                <Input id="engagementRate" name="engagementRate" type="number" inputMode="decimal" min={0} max={100} step="0.1" defaultValue={v("engagementRate")} aria-invalid={!!errors.engagementRate} />
              </Field>
              <Field label={opt("Audience type")} htmlFor="audienceCategory" error={errors.audienceCategory}>
                <NativeSelect id="audienceCategory" name="audienceCategory" defaultValue={v("audienceCategory")}>
                  <Options list={AUDIENCE_CATEGORIES} current={v("audienceCategory")} placeholder="Select audience" />
                </NativeSelect>
              </Field>
              <Field label={opt("Audience location")} htmlFor="audienceLocation" error={errors.audienceLocation}>
                <Input id="audienceLocation" name="audienceLocation" defaultValue={v("audienceLocation")} placeholder="India (mostly metro cities)" aria-invalid={!!errors.audienceLocation} />
              </Field>
              <Field label={opt("Previous brand campaigns")} htmlFor="previousCampaigns" error={errors.previousCampaigns} className="sm:col-span-2">
                <Textarea id="previousCampaigns" name="previousCampaigns" rows={3} defaultValue={v("previousCampaigns")} aria-invalid={!!errors.previousCampaigns} />
              </Field>
              <Field label={opt("Content samples")} htmlFor="contentSamples" error={errors.contentSamples} className="sm:col-span-2" hint="One public link per line (up to 10).">
                <Textarea id="contentSamples" name="contentSamples" rows={3} defaultValue={v("contentSamples")} aria-invalid={!!errors.contentSamples} />
              </Field>
            </div>
          </FormSection>
        ) : null}
      </MoreDetails>
    </>
  );
}
