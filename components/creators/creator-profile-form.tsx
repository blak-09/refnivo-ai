"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import type { CreatorProfile } from "@prisma/client";
import { saveCreatorProfileAction } from "@/app/actions/creator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { ImageUpload } from "@/components/uploads/image-upload";
import { SelfReported } from "@/components/creators/creator-stats";
import { AUDIENCE_CATEGORIES, CREATOR_CATEGORIES } from "@/lib/utils/labels";

export function CreatorProfileForm({ profile, defaultName, uploadsEnabled = true }: { profile?: CreatorProfile | null; defaultName?: string; uploadsEnabled?: boolean }) {
  const [state, action] = useActionState(saveCreatorProfileAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  const dv = (key: string, fallback: string | number | null | undefined) => values[key] ?? (fallback ?? "");
  const samples = Array.isArray(profile?.contentSamples) ? (profile!.contentSamples as string[]).join("\n") : "";

  React.useEffect(() => {
    if (state?.ok && profile) toast.success("Profile saved.");
  }, [state, profile]);

  return (
    <form key={attempt} action={action} className="space-y-8" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Basics</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Display name" htmlFor="displayName" error={errors.displayName} required>
            <Input id="displayName" name="displayName" defaultValue={dv("displayName", profile?.displayName ?? defaultName)} placeholder="Arjun Reviews Tech" required aria-invalid={!!errors.displayName} />
          </Field>
          <Field label="Username" htmlFor="username" error={errors.username} required hint="Public URL: /creators/username. Also used in your referral codes.">
            <Input id="username" name="username" defaultValue={dv("username", profile?.username)} placeholder="arjuntech" required aria-invalid={!!errors.username} />
          </Field>
          <Field label="Profile photo" htmlFor="profileImageUrl" error={errors.profileImageUrl} className="sm:col-span-2" hint="Shown to brands reviewing your applications and on your public profile.">
            <ImageUpload name="profileImageUrl" endpoint="/api/uploads/creator-image" initialUrl={String(dv("profileImageUrl", profile?.profileImageUrl)) || undefined} label="Upload profile photo" aspect="aspect-square max-w-48" disabled={!uploadsEnabled} />
          </Field>
          <Field label="Bio" htmlFor="bio" error={errors.bio} className="sm:col-span-2">
            <Textarea id="bio" name="bio" rows={3} defaultValue={dv("bio", profile?.bio)} placeholder="Honest gadget reviews for students and first-jobbers. 2 videos a week." />
          </Field>
          <Field label="Creator category" htmlFor="category" error={errors.category}>
            <NativeSelect id="category" name="category" defaultValue={dv("category", profile?.category)}>
              <option value="">Select category</option>
              {CREATOR_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Location" htmlFor="location" error={errors.location}>
            <Input id="location" name="location" defaultValue={dv("location", profile?.location)} placeholder="Bengaluru, India" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Social media & audience</h3>
          <SelfReported />
        </div>
        <p className="text-xs text-muted-foreground">
          Brands see these numbers when reviewing your applications. They are labelled self-reported until a social media API is connected.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Instagram handle" htmlFor="instagramHandle" error={errors.instagramHandle}>
            <Input id="instagramHandle" name="instagramHandle" defaultValue={dv("instagramHandle", profile?.instagramHandle)} placeholder="@arjuntech" aria-invalid={!!errors.instagramHandle} />
          </Field>
          <Field label="Instagram URL" htmlFor="instagramUrl" error={errors.instagramUrl}>
            <Input id="instagramUrl" name="instagramUrl" type="url" defaultValue={dv("instagramUrl", profile?.instagramUrl)} placeholder="https://instagram.com/arjuntech" aria-invalid={!!errors.instagramUrl} />
          </Field>
          <Field label="Instagram followers" htmlFor="instagramFollowers" error={errors.instagramFollowers}>
            <Input id="instagramFollowers" name="instagramFollowers" type="number" inputMode="numeric" min={0} defaultValue={dv("instagramFollowers", profile?.instagramFollowers)} placeholder="42000" aria-invalid={!!errors.instagramFollowers} />
          </Field>
          <Field label="YouTube channel" htmlFor="youtubeChannel" error={errors.youtubeChannel}>
            <Input id="youtubeChannel" name="youtubeChannel" defaultValue={dv("youtubeChannel", profile?.youtubeChannel)} placeholder="Arjun Reviews Tech" />
          </Field>
          <Field label="YouTube URL" htmlFor="youtubeUrl" error={errors.youtubeUrl}>
            <Input id="youtubeUrl" name="youtubeUrl" type="url" defaultValue={dv("youtubeUrl", profile?.youtubeUrl)} placeholder="https://youtube.com/@arjuntech" aria-invalid={!!errors.youtubeUrl} />
          </Field>
          <Field label="YouTube subscribers" htmlFor="youtubeSubscribers" error={errors.youtubeSubscribers}>
            <Input id="youtubeSubscribers" name="youtubeSubscribers" type="number" inputMode="numeric" min={0} defaultValue={dv("youtubeSubscribers", profile?.youtubeSubscribers)} placeholder="120000" aria-invalid={!!errors.youtubeSubscribers} />
          </Field>
          <Field label="X / Twitter handle" htmlFor="twitterHandle" error={errors.twitterHandle}>
            <Input id="twitterHandle" name="twitterHandle" defaultValue={dv("twitterHandle", profile?.twitterHandle)} placeholder="@arjuntech" aria-invalid={!!errors.twitterHandle} />
          </Field>
          <Field label="X / Twitter URL" htmlFor="twitterUrl" error={errors.twitterUrl}>
            <Input id="twitterUrl" name="twitterUrl" type="url" defaultValue={dv("twitterUrl", profile?.twitterUrl)} placeholder="https://x.com/arjuntech" aria-invalid={!!errors.twitterUrl} />
          </Field>
          <Field label="Average views per post" htmlFor="averageViews" error={errors.averageViews}>
            <Input id="averageViews" name="averageViews" type="number" inputMode="numeric" min={0} defaultValue={dv("averageViews", profile?.averageViews)} placeholder="25000" aria-invalid={!!errors.averageViews} />
          </Field>
          <Field label="Engagement rate (%)" htmlFor="engagementRate" error={errors.engagementRate}>
            <Input id="engagementRate" name="engagementRate" type="number" inputMode="decimal" min={0} max={100} step="0.1" defaultValue={dv("engagementRate", profile?.engagementRate)} placeholder="4.2" aria-invalid={!!errors.engagementRate} />
          </Field>
          <Field label="Audience category" htmlFor="audienceCategory" error={errors.audienceCategory}>
            <NativeSelect id="audienceCategory" name="audienceCategory" defaultValue={dv("audienceCategory", profile?.audienceCategory)}>
              <option value="">Select audience</option>
              {AUDIENCE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Audience location" htmlFor="audienceLocation" error={errors.audienceLocation}>
            <Input id="audienceLocation" name="audienceLocation" defaultValue={dv("audienceLocation", profile?.audienceLocation)} placeholder="India (70% metro cities)" />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold">Experience</h3>
        <div className="grid gap-4">
          <Field label="Previous campaigns" htmlFor="previousCampaigns" error={errors.previousCampaigns} hint="Brands you have worked with and what you did.">
            <Textarea id="previousCampaigns" name="previousCampaigns" rows={3} defaultValue={dv("previousCampaigns", profile?.previousCampaigns)} placeholder="Noise ColorFit launch (reel + story), Realme Narzo unboxing…" />
          </Field>
          <Field label="Content samples" htmlFor="contentSamples" error={errors.contentSamples} hint="One public URL per line (reels, videos, posts). Up to 10.">
            <Textarea id="contentSamples" name="contentSamples" rows={3} defaultValue={dv("contentSamples", samples)} placeholder={"https://www.instagram.com/reel/…\nhttps://youtu.be/…"} />
          </Field>
        </div>
      </section>

      <div className="flex justify-end">
        <SubmitButton pendingText="Saving…">{profile ? "Save profile" : "Create profile & continue"}</SubmitButton>
      </div>
    </form>
  );
}
