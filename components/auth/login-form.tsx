"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { GiftIcon, LinkIcon, ShieldCheckIcon, StoreIcon, type LucideIcon } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { GoogleAuthForm, OrDivider } from "@/components/auth/google-button";
import { cn } from "@/lib/utils";

export type QuickAccount = { role: string; label: string; email: string; password: string };

const ROLE_ICON: Record<string, LucideIcon> = {
  BRAND_OWNER: StoreIcon,
  CREATOR: LinkIcon,
  CUSTOMER: GiftIcon,
  ADMIN: ShieldCheckIcon,
};

export function LoginForm({
  callbackUrl,
  notice,
  error,
  quickAccounts = [],
  googleEnabled = false,
}: {
  callbackUrl?: string;
  notice?: string;
  /** Message for a failed Google sign-in (already user-friendly; see app/auth/login/page.tsx). */
  error?: string;
  quickAccounts?: QuickAccount[];
  googleEnabled?: boolean;
}) {
  const [state, action] = useActionState(loginAction, null);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  function fill(acc: QuickAccount) {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelected(acc.email);
  }

  const statusCode = state && !state.ok ? state.fieldErrors?._status : undefined;

  return (
    <div className="space-y-5">
      {quickAccounts.length ? (
        <div className="rounded-lg border border-dashed bg-muted/40 p-3">
          <p className="text-xs font-medium">Quick sign-in (demo accounts)</p>
          <p className="mb-2 text-xs text-muted-foreground">Pick a role to fill the form, then press Log in.</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {quickAccounts.map((acc) => {
              const Icon = ROLE_ICON[acc.role] ?? StoreIcon;
              const active = selected === acc.email;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fill(acc)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border bg-background px-2 py-2 text-xs font-medium transition-colors hover:bg-accent",
                    active && "border-primary bg-primary/5 text-primary",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {acc.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {notice ? <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{notice}</p> : null}
      {error && !state ? <FormError message={error} /> : null}

      {googleEnabled ? (
        <>
          <GoogleAuthForm callbackUrl={callbackUrl} />
          <OrDivider>or log in with email</OrDivider>
        </>
      ) : null}

      <form action={action} className="space-y-4" noValidate>
        <FormError message={state && !state.ok ? state.error : null} />

        {statusCode ? (
          <p className="text-sm">
            {statusCode === "PENDING" || statusCode === "REJECTED" ? (
              <Link href="/check-registration" className="font-medium text-primary underline-offset-4 hover:underline">
                Check registration status →
              </Link>
            ) : statusCode === "NO_ACCOUNT" ? (
              <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
                Create an account →
              </Link>
            ) : statusCode === "NO_PASSWORD" ? (
              <Link href="/auth/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
                Set a password →
              </Link>
            ) : statusCode === "SUSPENDED" ? (
              <Link href="/contact" className="font-medium text-primary underline-offset-4 hover:underline">
                Contact support →
              </Link>
            ) : null}
          </p>
        ) : null}

        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}

        <Field label="Email" htmlFor="email" required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <Field label="Password" htmlFor="password" required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <SubmitButton className="w-full" pendingText="Signing in…">
          Log in
        </SubmitButton>
        <p className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <Link href="/auth/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
            Forgot password?
          </Link>
          <span>
            New here?{" "}
            <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Create an account
            </Link>
          </span>
        </p>
      </form>
    </div>
  );
}
