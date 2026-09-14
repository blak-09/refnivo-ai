"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { GiftIcon, LinkIcon, StoreIcon, type LucideIcon } from "lucide-react";
import { registerAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormAttempt } from "@/components/forms/use-form-attempt";
import { cn } from "@/lib/utils";

type Role = "BRAND_OWNER" | "CREATOR" | "CUSTOMER";

const ROLE_OPTIONS: { value: Role; label: string; description: string; icon: LucideIcon }[] = [
  { value: "BRAND_OWNER", label: "Brand", description: "List products, run affiliate campaigns", icon: StoreIcon },
  { value: "CREATOR", label: "Creator", description: "Promote products, earn commissions", icon: LinkIcon },
  { value: "CUSTOMER", label: "Customer", description: "Share products, earn rewards", icon: GiftIcon },
];

export function RegisterForm({ initialRole }: { initialRole?: string }) {
  const [state, action] = useActionState(registerAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const values = state && !state.ok ? state.values ?? {} : {};
  const attempt = useFormAttempt(state);
  const [role, setRole] = React.useState<Role>(
    ROLE_OPTIONS.some((r) => r.value === initialRole) ? (initialRole as Role) : "BRAND_OWNER",
  );

  return (
    <form key={attempt} action={action} className="space-y-5" noValidate>
      <FormError message={state && !state.ok ? state.error : null} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">I am joining as a</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {ROLE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                role === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="role"
                value={opt.value}
                checked={role === opt.value}
                onChange={() => setRole(opt.value)}
                className="sr-only"
              />
              <opt.icon className={cn("size-4", role === opt.value ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.description}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Full name" htmlFor="name" error={errors.name} required>
        <Input id="name" name="name" autoComplete="name" defaultValue={values.name} required aria-invalid={!!errors.name} />
      </Field>
      <Field label="Email" htmlFor="email" error={errors.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" defaultValue={values.email} required aria-invalid={!!errors.email} />
      </Field>
      <Field label="Phone (optional)" htmlFor="phone" error={errors.phone} hint="Used only for account recovery and partner coordination.">
        <Input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={values.phone} placeholder="+91 98765 43210" aria-invalid={!!errors.phone} />
      </Field>
      <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters with a letter and a number." required>
        <Input id="password" name="password" type="password" autoComplete="new-password" required aria-invalid={!!errors.password} />
      </Field>

      <SubmitButton className="w-full" pendingText="Creating account…">
        Create account
      </SubmitButton>
      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <Link href="/terms" className="underline underline-offset-4">Terms</Link> and{" "}
        <Link href="/privacy" className="underline underline-offset-4">Privacy policy</Link>.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
