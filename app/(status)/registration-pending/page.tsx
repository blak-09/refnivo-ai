import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegistrationStatusCard } from "@/components/auth/registration-status-card";
import { findRegistrationById } from "@/lib/services/registrations";

export const metadata: Metadata = { title: "Registration submitted" };

export default async function RegistrationPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ rid?: string }>;
}) {
  const { rid } = await searchParams;
  const registration = rid ? await findRegistrationById(rid) : null;

  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard
          title="Registration submitted"
          description="Your registration has been submitted successfully. Our team will review your details. You will receive access after approval."
        >
          {registration ? (
            <RegistrationStatusCard
              name={registration.name}
              role={registration.role}
              status={registration.status}
              registrationId={registration.registrationId}
              createdAt={registration.createdAt}
              rejectionReason={registration.rejectionReason}
            />
          ) : (
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>
                Thanks for signing up. Keep your Registration ID handy — you can use it any time to{" "}
                <Link href="/check-registration" className="font-medium text-primary underline-offset-4 hover:underline">
                  check your status
                </Link>
                .
              </p>
              <p>
                Already approved?{" "}
                <Link href="/auth/login" className="font-medium text-primary underline-offset-4 hover:underline">
                  Log in
                </Link>
                .
              </p>
            </div>
          )}
        </AuthCard>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Need to check later?{" "}
          <Link href="/check-registration" className="underline underline-offset-4">
            Check registration status
          </Link>
        </p>
      </div>
    </div>
  );
}
