import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { CheckRegistrationForm } from "@/components/auth/check-registration-form";

export const metadata: Metadata = { title: "Check registration status" };

export default function CheckRegistrationPage() {
  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard
          title="Check your registration"
          description="Enter your Registration ID or the email you signed up with to see your current status."
        >
          <CheckRegistrationForm />
        </AuthCard>
      </div>
    </div>
  );
}
