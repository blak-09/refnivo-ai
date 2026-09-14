import Link from "next/link";
import type { Metadata } from "next";
import { ExternalLinkIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { CreatorProfileForm } from "@/components/creators/creator-profile-form";
import { Progress } from "@/components/ui/progress";
import { profileCompletion } from "@/lib/services/creators";
import { requireCreator } from "@/lib/auth/guards";
import { VERIFICATION_LABEL } from "@/lib/utils/labels";

export const metadata: Metadata = { title: "Creator profile" };

export default async function CreatorProfilePage() {
  const { profile } = await requireCreator();
  const completion = profileCompletion(profile as unknown as Record<string, unknown>);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Creator profile"
        description={
          <span className="flex flex-wrap items-center gap-2">
            What brands see when you apply.
            <StatusBadge status={profile.verificationStatus} label={VERIFICATION_LABEL[profile.verificationStatus]} />
            <Link href={`/creators/${profile.username}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
              View public profile <ExternalLinkIcon className="size-3" />
            </Link>
          </span>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Profile completion</p>
            <p className="text-xs text-muted-foreground">
              {completion === 100 ? "Your profile looks great to brands." : "A complete profile gets more applications approved."}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:w-64">
            <Progress value={completion} className="flex-1" aria-label="Profile completion" />
            <span className="text-sm font-semibold tabular-nums">{completion}%</span>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{profile.displayName}</CardTitle>
          <CardDescription>Audience numbers are labelled self-reported until a social media API is connected.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreatorProfileForm profile={profile} />
        </CardContent>
      </Card>
    </div>
  );
}
