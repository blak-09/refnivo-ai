import type { Metadata } from "next";
import { InfoIcon, ShieldCheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/primitives";
import { SocialAccountCard, type PlatformRow } from "@/components/social/social-account-card";
import { requireCreator } from "@/lib/auth/guards";
import { socialAccountMatrix } from "@/lib/services/social-accounts";

export const metadata: Metadata = { title: "Social accounts" };

const ERRORS: Record<string, string> = {
  cancelled: "You cancelled the connection — nothing was linked.",
  state: "That link expired or did not start here. Please press Connect again.",
  expired: "The connection took too long. Please press Connect again.",
  unavailable: "That platform is not enabled on this deployment yet.",
  claimed: "That account is already linked to another Refnivo profile.",
  provider: "The platform refused the connection.",
  "rate-limited": "Too many attempts. Please try again in a little while.",
};

/**
 * Creator → Social accounts. Connecting runs the platform's own OAuth flow, so
 * Refnivo never sees a social password, and the page only ever shows figures a
 * platform actually returned.
 */
export default async function SocialAccountsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string; detail?: string }> }) {
  const { user } = await requireCreator();
  const [rows, sp] = await Promise.all([socialAccountMatrix(user.id), searchParams]);
  const anyConfigured = rows.some((r) => r.configured);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Social accounts"
        description="Link the accounts you post from. Brands see your verified handles on your profile, and you keep one place to manage them."
      />

      {sp.connected ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="py-2 text-sm">
            <p className="font-medium">Connected — your profile now shows this account.</p>
          </CardContent>
        </Card>
      ) : null}
      {sp.error ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="py-2 text-sm">
            <p className="font-medium">{ERRORS[sp.error] ?? "That connection could not be completed."}</p>
            {sp.detail ? <p className="mt-1 text-muted-foreground">{sp.detail}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {!anyConfigured ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3 py-2 text-sm">
            <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-medium">Social connections are not switched on yet</p>
              <p className="mt-1 text-muted-foreground">
                Each platform needs its own developer app before Refnivo can offer it. Until then you can still add your handles by hand on your profile — they
                are shown as self-reported.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li key={row.platform}>
            <SocialAccountCard row={row as PlatformRow} />
          </li>
        ))}
      </ul>

      <Card>
        <CardContent className="flex items-start gap-3 py-2 text-sm">
          <ShieldCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div className="text-muted-foreground">
            <p className="font-medium text-foreground">What Refnivo can and cannot see</p>
            <p className="mt-1">
              You sign in on the platform itself — Refnivo never receives your password. We ask only for the permissions listed on each card, store the resulting
              access encrypted, and read nothing else. Follower counts appear only where a platform officially provides them; where it does not, the card says so
              rather than showing a number.
            </p>
            <p className="mt-1">Disconnecting deletes that access. Your campaigns, referral links, orders, commissions and payouts are never affected.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
