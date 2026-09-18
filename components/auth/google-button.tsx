"use client";

import { useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { googleSignInAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Google "G" mark (official colours), inline so no third-party asset is loaded. */
function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-4", className)}>
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.87c2.26-2.09 3.55-5.17 3.55-8.82Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.94-2.91l-3.87-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.29A7.2 7.2 0 0 1 4.9 12c0-.8.14-1.57.37-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

function GoogleSubmit({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="lg" className="w-full gap-2.5" disabled={pending || disabled} aria-busy={pending}>
      {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <GoogleMark />}
      {pending ? "Redirecting to Google…" : label}
    </Button>
  );
}

/**
 * "Continue with Google". A standalone <form> (never nested in another form)
 * posting to a Server Action, so it also works before JavaScript loads.
 *
 * - `role`: the account type chosen on the register page; omitted on the login page.
 * - `callbackUrl`: where to land after sign-in (login page only; validated server-side).
 */
export function GoogleAuthForm({
  role,
  callbackUrl,
  label = "Continue with Google",
  disabled,
  className,
}: {
  role?: string;
  callbackUrl?: string;
  label?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <form action={googleSignInAction} className={className}>
      {role ? <input type="hidden" name="role" value={role} /> : null}
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <GoogleSubmit label={label} disabled={disabled} />
    </form>
  );
}

/** "──── or ────" separator between Google and the e-mail form. */
export function OrDivider({ children = "or" }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground" role="separator">
      <span className="h-px flex-1 bg-border" />
      <span>{children}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
