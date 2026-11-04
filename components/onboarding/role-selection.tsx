"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRightIcon, CheckCircle2Icon, CheckIcon, Loader2Icon } from "lucide-react";
import { chooseRoleAction } from "@/app/actions/onboarding";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/forms/field";
import { RoleIcon } from "@/components/onboarding/role-icon";
import { ROLE_CARDS, ROLE_ORDER } from "@/lib/onboarding/roles";
import type { RegistrableRole } from "@/lib/validation/auth";
import { cn } from "@/lib/utils";

/**
 * Page 1 — "How would you like to use Refnivo?". Visitors continue to the
 * account step with the role in the URL; a signed-in account that has not
 * finished onboarding confirms (or, while safe, changes) its role on the server.
 */
export function RoleSelection({
  signedIn,
  initialRole,
  roleLocked = false,
  next,
  error,
}: {
  signedIn: boolean;
  initialRole?: RegistrableRole | null;
  /** Signed in and the role can no longer change (e.g. an existing profile). */
  roleLocked?: boolean;
  next?: string | null;
  error?: string | null;
}) {
  const [selected, setSelected] = React.useState<RegistrableRole | null>(initialRole ?? null);
  const [state, dispatch, pending] = useActionState(chooseRoleAction, null);
  const [submitted, setSubmitted] = React.useState<RegistrableRole | null>(null);

  // Visitors go to the account step with the role in the URL (a plain link, so
  // it works before JavaScript loads); signed-in accounts post to the server.
  const registerHref = (role: RegistrableRole) => {
    const params = new URLSearchParams({ role });
    if (next) params.set("next", next);
    return `/auth/register?${params}`;
  };

  /** The card CTA / Continue control for `role` (a render helper, not a component, so it is never remounted). */
  function renderProceed({ role, children, className, variant }: { role: RegistrableRole; children: React.ReactNode; className?: string; variant?: "default" | "outline" }) {
    if (!signedIn) {
      return (
        <Button size="lg" variant={variant} className={className} nativeButton={false} render={<Link href={registerHref(role)} onClick={(e) => e.stopPropagation()} />}>
          {children}
        </Button>
      );
    }
    return (
      <form action={dispatch} onSubmit={() => setSubmitted(role)} onClick={(e) => e.stopPropagation()}>
        <input type="hidden" name="role" value={role} />
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <Button type="submit" size="lg" variant={variant} className={cn("w-full", className)} disabled={pending}>
          {pending && submitted === role ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
          {children}
        </Button>
      </form>
    );
  }

  // Arrow keys move between cards (radio-group pattern).
  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const idx = Math.max(0, ROLE_ORDER.indexOf(selected ?? ROLE_ORDER[0]));
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
    const nextRole = ROLE_ORDER[(idx + step + ROLE_ORDER.length) % ROLE_ORDER.length];
    if (roleLocked && nextRole !== initialRole) return;
    setSelected(nextRole);
    document.getElementById(`role-card-${nextRole}`)?.focus();
  }

  return (
    <div className="space-y-6">
      <FormError message={state && !state.ok ? state.error : error} />

      <div role="radiogroup" aria-label="Account type" className="grid gap-4 md:grid-cols-3" onKeyDown={onKeyDown}>
        {ROLE_ORDER.map((role) => {
          const card = ROLE_CARDS[role];
          const active = selected === role;
          const disabled = roleLocked && role !== initialRole;
          return (
            <div
              key={role}
              id={`role-card-${role}`}
              role="radio"
              aria-checked={active}
              aria-disabled={disabled || undefined}
              tabIndex={active || (!selected && role === ROLE_ORDER[0]) ? 0 : -1}
              onClick={() => !disabled && setSelected(role)}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !disabled && e.target === e.currentTarget) {
                  e.preventDefault();
                  setSelected(role);
                }
              }}
              className={cn(
                "group relative flex cursor-pointer flex-col rounded-2xl border bg-card p-5 text-left transition-[border-color,box-shadow,transform] outline-none sm:p-6",
                "focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "border-primary shadow-lg shadow-primary/10 ring-1 ring-primary" : "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
                disabled && "pointer-events-none opacity-50",
              )}
            >
              <div className="flex items-start justify-between">
                <span className={cn("flex size-12 items-center justify-center rounded-xl transition-colors", active ? "bg-gradient-brand text-white" : "bg-primary/10 text-primary")}>
                  <RoleIcon role={role} className="size-6" />
                </span>
                <span
                  className={cn("flex size-6 items-center justify-center rounded-full border-2 transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-border")}
                  aria-hidden
                >
                  {active ? <CheckIcon className="size-3.5" /> : null}
                </span>
              </div>
              <h2 className="mt-5 text-lg font-semibold tracking-tight">{card.title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{card.description}</p>
              <ul className="mt-4 space-y-2 text-sm">
                {card.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-6">
                {renderProceed({ role, variant: active ? "default" : "outline", className: cn("w-full", active && "bg-gradient-brand text-white hover:opacity-95"), children: card.cta })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-center text-sm text-muted-foreground sm:text-left">
          {signedIn ? "You can update your profile any time from Settings." : "You can change this before you finish signing up."}
        </p>
        {selected ? (
          renderProceed({
            role: selected,
            className: "bg-gradient-brand min-w-40 text-white hover:opacity-95",
            children: (
              <>
                Continue <ArrowRightIcon aria-hidden />
              </>
            ),
          })
        ) : (
          <Button size="lg" className="min-w-40" disabled>
            Continue <ArrowRightIcon aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
