import type { Metadata } from "next";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role } = await searchParams;
  return (
    <div className="w-full pt-10">
      <div className="mx-auto w-full max-w-md">
        <AuthCard title="Create your account" description="Brands, creators and customers all start here. Accounts are reviewed before first sign-in.">
          <RegisterForm initialRole={role} />
        </AuthCard>
      </div>
    </div>
  );
}
