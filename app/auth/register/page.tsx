import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { manualReviewRoles } from "@/lib/config/signup-policy";
import { googleOAuthEnabled } from "@/lib/config/oauth";

export const metadata: Metadata = { title: "Create account" };

const ERROR_MESSAGES: Record<string, string> = {
  "google-no-account": "There is no account for that Google e-mail yet. Choose your account type and continue with Google to create one.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string; error?: string }> }) {
  const { role, error } = await searchParams;
  const manual = manualReviewRoles();
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Something went wrong. Please try again." : undefined;
  const description =
    manual.length === 0
      ? "Brands, creators and customers all start here. You can use your account right after signing up."
      : manual.length === 3
        ? "Brands, creators and customers all start here. Accounts are reviewed before first sign-in."
        : "Brands, creators and customers all start here. Some account types are reviewed before first sign-in.";
  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard title="Create your account" description={description}>
          <RegisterForm initialRole={role} manualReviewRoles={manual} googleEnabled={googleOAuthEnabled()} error={errorMessage} />
        </AuthCard>
      </div>
    </div>
  );
}
