"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { GiftIcon, LinkIcon, ShieldCheckIcon, StoreIcon, type LucideIcon } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import { Input } from "@/components/ui/input";
import { Field, FormError } from "@/components/forms/field";
import { SubmitButton } from "@/components/forms/submit-button";
import { cn } from "@/lib/utils";

export type QuickAccount = { role: string; label: string; email: string; password: string };

const ROLE_ICON: Record<string, LucideIcon> = {
  RESTAURANT_OWNER: StoreIcon,
  CREATOR: LinkIcon,
  CUSTOMER: GiftIcon,
  ADMIN: ShieldCheckIcon,
};

export function LoginForm({
  callbackUrl,
  notice,
  quickAccounts = [],
}: {
  callbackUrl?: string;
  notice?: string;
  /** Dev-only demo IDs; clicking one fills the form. */
  quickAccounts?: QuickAccount[];
}) {
  const [state, action] = useActionState(loginAction, null);
  const errors = state && !state.ok ? state.fieldErrors ?? {} : {};
  const echoed = state && !state.ok ? state.values ?? {} : {};

  const [email, setEmail] = React.useState(echoed.email ?? "");
  const [password, setPassword] = React.useState("");
  const [seen, setSeen] = React.useState(state);
  // Restore the typed email after a failed submit (React resets the form).
  React.useEffect(() => {
    if (state === seen) return;
    setSeen(state);
    if (state && !state.ok && state.values?.email) setEmail(state.values.email);
  }, [state, seen]);

  const [selected, setSelected] = React.useState<string | null>(null);
  function fill(acc: QuickAccount) {
    setEmail(acc.email);
    setPassword(acc.password);
    setSelected(acc.email);
  }

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

      <form action={action} className="space-y-4" noValidate>
        {notice ? <p className="rounded-lg bg-accent px-3 py-2 text-sm text-accent-foreground">{notice}</p> : null}
        <FormError message={state && !state.ok ? state.error : null} />
        {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
        <Field label="Email" htmlFor="email" error={errors.email} required>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} required>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!errors.password}
          />
        </Field>
        <SubmitButton className="w-full" pendingText="Signing in…">
          Log in
        </SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}
