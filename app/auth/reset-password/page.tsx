import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/password-reset-forms";
import { peekResetToken } from "@/lib/services/password-reset";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const valid = token ? await peekResetToken(token) : false;

  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard
          title="Choose a new password"
          description={valid ? "After saving, every existing session is signed out and you log in with the new password." : undefined}
        >
          {valid && token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4 text-sm">
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive">
                This reset link is invalid, has expired, or was already used.
              </p>
              <Link href="/auth/forgot-password" className="font-medium text-primary underline-offset-4 hover:underline">
                Request a new link
              </Link>
            </div>
          )}
        </AuthCard>
      </div>
    </div>
  );
}
