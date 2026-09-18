"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { GiftIcon, LinkIcon, StoreIcon, type LucideIcon } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { GoogleAuthForm, OrDivider } from "@/components/auth/google-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { BRAND_CATEGORIES, CREATOR_CATEGORIES } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

type Role = "BRAND_OWNER" | "CREATOR" | "CUSTOMER";

const ROLE_OPTIONS: {
  value: Role;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "BRAND_OWNER",
    label: "Brand",
    description: "List products, run affiliate campaigns",
    icon: StoreIcon,
  },
  {
    value: "CREATOR",
    label: "Creator",
    description: "Promote products, earn commissions",
    icon: LinkIcon,
  },
  {
    value: "CUSTOMER",
    label: "Customer",
    description: "Share products, earn rewards",
    icon: GiftIcon,
  },
];

export function RegisterForm({
  initialRole,
  manualReviewRoles = [],
  googleEnabled = false,
  error,
}: {
  initialRole?: string;
  manualReviewRoles?: string[];
  googleEnabled?: boolean;
  /** Message for a failed Google sign-up (see app/auth/register/page.tsx). */
  error?: string;
}) {
  const [state, action] = useActionState(registerAction, null);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};
  const values = state && !state.ok ? (state.values ?? {}) : {};
  const attempt = useFormAttempt(state);
  // The form remounts after a failed submit (see useFormAttempt), so seed the
  // role from the value the user actually submitted — not the URL prop — to
  // keep their selection and the matching role-specific fields intact.
  const preferredRole = values.role ?? initialRole;
  const [role, setRole] = React.useState<Role>(
    ROLE_OPTIONS.some((r) => r.value === preferredRole)
      ? (preferredRole as Role)
      : "BRAND_OWNER",
  );

  const roleLabel =
    ROLE_OPTIONS.find((r) => r.value === role)?.label.toLowerCase() ?? "";

  return (
    <div className="space-y-5">
      {error && !state ? <FormError message={error} /> : null}

      {/* The account type lives OUTSIDE the e-mail form so the Google form (a
          sibling — forms cannot nest) can post the same choice. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am joining as a</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                role === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="role-choice"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="sr-only"
              />
              <opt.icon
                className={cn(
                  "size-4",
                  role === opt.value ? "text-primary" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">
                {opt.description}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {googleEnabled ? (
        <>
          <GoogleAuthForm
            role={role}
            label={`Continue with Google as a ${roleLabel}`}
          />
          <OrDivider>or sign up with email</OrDivider>
        </>
      ) : null}

      <form key={attempt} action={action} className="space-y-5" noValidate>
        <FormError message={state && !state.ok ? state.error : null} />
        <input type="hidden" name="role" value={role} />

        <div className="space-y-4">
          <Field label="Full name" htmlFor="name" error={errors.name} required>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              defaultValue={values.name}
              required
              aria-invalid={!!errors.name}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email} required>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={values.email}
              required
              aria-invalid={!!errors.email}
            />
          </Field>
          <Field
            label="Phone (optional)"
            htmlFor="phone"
            error={errors.phone}
            hint="Used only for account recovery and partner coordination."
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              defaultValue={values.phone}
              placeholder="+91 98765 43210"
              aria-invalid={!!errors.phone}
            />
          </Field>
        </div>

        {/* Brand-owner specific */}
        {role === "BRAND_OWNER" ? (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Brand details</p>
            <Field
              label="Brand name"
              htmlFor="brandName"
              error={errors.brandName}
              required
            >
              <Input
                id="brandName"
                name="brandName"
                defaultValue={values.brandName}
                required
                aria-invalid={!!errors.brandName}
                placeholder="e.g. Soundwave Audio"
              />
            </Field>
            <Field
              label="Brand website (optional)"
              htmlFor="brandWebsite"
              error={errors.brandWebsite}
            >
              <Input
                id="brandWebsite"
                name="brandWebsite"
                type="url"
                defaultValue={values.brandWebsite}
                placeholder="https://yourbrand.com"
                aria-invalid={!!errors.brandWebsite}
              />
            </Field>
            <Field
              label="Brand category"
              htmlFor="brandCategory"
              error={errors.brandCategory}
              required
            >
              <NativeSelect
                id="brandCategory"
                name="brandCategory"
                defaultValue={values.brandCategory ?? ""}
                aria-invalid={!!errors.brandCategory}
              >
                <option value="" disabled>
                  Select a category
                </option>
                {BRAND_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label="Brand description (optional)"
              htmlFor="brandDescription"
              error={errors.brandDescription}
            >
              <Textarea
                id="brandDescription"
                name="brandDescription"
                defaultValue={values.brandDescription}
                rows={3}
                placeholder="What does your brand sell?"
                aria-invalid={!!errors.brandDescription}
              />
            </Field>
          </div>
        ) : null}

        {/* Creator specific */}
        {role === "CREATOR" ? (
          <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">Creator details</p>
            <Field
              label="Creator name"
              htmlFor="creatorName"
              error={errors.creatorName}
              required
            >
              <Input
                id="creatorName"
                name="creatorName"
                defaultValue={values.creatorName}
                required
                aria-invalid={!!errors.creatorName}
                placeholder="Your public creator name"
              />
            </Field>
            <Field
              label="Content category"
              htmlFor="creatorCategory"
              error={errors.creatorCategory}
              required
            >
              <NativeSelect
                id="creatorCategory"
                name="creatorCategory"
                defaultValue={values.creatorCategory ?? ""}
                aria-invalid={!!errors.creatorCategory}
              >
                <option value="" disabled>
                  Select a category
                </option>
                {CREATOR_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Instagram handle (optional)"
                htmlFor="instagramHandle"
                error={errors.instagramHandle}
              >
                <Input
                  id="instagramHandle"
                  name="instagramHandle"
                  defaultValue={values.instagramHandle}
                  placeholder="@yourhandle"
                  aria-invalid={!!errors.instagramHandle}
                />
              </Field>
              <Field
                label="Instagram followers (optional)"
                htmlFor="instagramFollowers"
                error={errors.instagramFollowers}
              >
                <Input
                  id="instagramFollowers"
                  name="instagramFollowers"
                  inputMode="numeric"
                  defaultValue={values.instagramFollowers}
                  placeholder="e.g. 12000"
                  aria-invalid={!!errors.instagramFollowers}
                />
              </Field>
              <Field
                label="YouTube channel (optional)"
                htmlFor="youtubeChannel"
                error={errors.youtubeChannel}
              >
                <Input
                  id="youtubeChannel"
                  name="youtubeChannel"
                  defaultValue={values.youtubeChannel}
                  placeholder="Channel name or URL"
                  aria-invalid={!!errors.youtubeChannel}
                />
              </Field>
              <Field
                label="YouTube subscribers (optional)"
                htmlFor="youtubeSubscribers"
                error={errors.youtubeSubscribers}
              >
                <Input
                  id="youtubeSubscribers"
                  name="youtubeSubscribers"
                  inputMode="numeric"
                  defaultValue={values.youtubeSubscribers}
                  placeholder="e.g. 5000"
                  aria-invalid={!!errors.youtubeSubscribers}
                />
              </Field>
            </div>
            <p className="text-xs text-muted-foreground">
              Follower and subscriber counts are self-reported.
            </p>
          </div>
        ) : null}

        <div className="space-y-4">
          <Field
            label="Password"
            htmlFor="password"
            error={errors.password}
            hint="At least 8 characters with a letter and a number."
            required
          >
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!errors.password}
            />
          </Field>
          <Field
            label="Confirm password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword}
            required
          >
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={!!errors.confirmPassword}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          {manualReviewRoles.includes(role)
            ? "Accounts of this type are reviewed by our team before you can sign in. You'll see your status right after signing up."
            : "Your account is ready as soon as you sign up — you'll be taken straight to your dashboard."}
        </div>

        <SubmitButton
          className="w-full"
          pendingText={
            manualReviewRoles.includes(role)
              ? "Submitting…"
              : "Creating your account…"
          }
        >
          Create account
        </SubmitButton>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy policy
          </Link>
          .
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
