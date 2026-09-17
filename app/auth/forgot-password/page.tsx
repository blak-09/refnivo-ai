import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/password-reset-forms";
import { isEmailConfigured } from "@/lib/email";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard title="Reset your password" description="Enter the e-mail you registered with and we will send a one-hour reset link.">
          <ForgotPasswordForm emailConfigured={isEmailConfigured()} />
        </AuthCard>
      </div>
    </div>
  );
}
