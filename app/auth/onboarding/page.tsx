import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { BrandForm } from "@/components/brand/brand-form";
import { CreatorProfileForm } from "@/components/creators/creator-profile-form";
import { requireUser } from "@/lib/auth/guards";
import { roleHome } from "@/lib/auth/roles";
import { getBrandForOwner } from "@/lib/services/brands";
import { getCreatorProfile } from "@/lib/services/creators";

export const metadata: Metadata = { title: "Onboarding" };

/**
 * Role-aware onboarding. Brand owners create their brand; creators create
 * their public profile. Customers go straight to their dashboard.
 */
export default async function OnboardingPage() {
  const user = await requireUser();

  if (user.role === "BRAND_OWNER") {
    if (await getBrandForOwner(user.id)) redirect("/dashboard/brand");
    return (
      <div className="w-full pt-10">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <div className="text-center">
            <p className="text-sm font-medium text-primary">Step 1 of 2</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Set up your brand</h1>
            <p className="mt-2 text-sm text-muted-foreground">This is what creators and customers will see. Next you will add your first product.</p>
          </div>
          <AuthCard title="Brand profile" wide>
            <BrandForm mode="create" />
          </AuthCard>
        </div>
      </div>
    );
  }

  if (user.role === "CREATOR") {
    if (await getCreatorProfile(user.id)) redirect("/dashboard/creator");
    return (
      <div className="w-full pt-10">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          <div className="text-center">
            <p className="text-sm font-medium text-primary">Creator onboarding</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create your creator profile</h1>
            <p className="mt-2 text-sm text-muted-foreground">Brands review this profile when you apply to their campaigns. You can edit it any time.</p>
          </div>
          <AuthCard title="Creator profile" wide>
            <CreatorProfileForm defaultName={user.name} />
          </AuthCard>
        </div>
      </div>
    );
  }

  redirect(roleHome(user.role));
}
