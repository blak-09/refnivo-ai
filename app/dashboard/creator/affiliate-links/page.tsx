import Link from "next/link";
import type { Metadata } from "next";
import { CompassIcon, InfoIcon, LinkIcon, MousePointerClickIcon, UsersIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, KpiCard, PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ReferralLinkCard } from "@/components/links/referral-link-card";
import { ProgramTypeBadge } from "@/components/affiliate/program-badge";
import { AffiliateLinkControls } from "@/components/affiliate/affiliate-link-controls";
import { requireCreator } from "@/lib/auth/guards";
import { creatorAffiliateStats, listCreatorAffiliateLinks } from "@/lib/services/affiliate-links";
import { SOURCE_LABEL } from "@/lib/services/channel-links";
import { referralQrDataUrl, referralUrl, shareTargets } from "@/lib/services/links";

export const metadata: Metadata = { title: "My affiliate links" };

/**
 * Creator → My affiliate links (external programmes).
 *
 * Every figure here is something Refnivo observed: clicks and unique visitors on
 * your Refnivo links. Sales and commission for an external programme are recorded
 * by that programme; until a verified integration imports them, this page says
 * so instead of showing a number.
 */
export default async function CreatorAffiliateLinksPage() {
  const { user } = await requireCreator();
  const [links, stats] = await Promise.all([listCreatorAffiliateLinks(user.id), creatorAffiliateStats(user.id)]);
  const active = links.filter((l) => l.status === "ACTIVE");

  const cards = await Promise.all(
    active.flatMap((link) =>
      link.codes
        .filter((c) => c.status === "ACTIVE")
        .map(async (c) => ({ link, code: c, url: referralUrl(c.code), qr: await referralQrDataUrl(c.code) })),
    ),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My affiliate links"
        description="Links into brands' own affiliate programmes. Share your Refnivo link: it counts the click, then forwards to your affiliate link."
        actions={
          <Button nativeButton={false} render={<Link href="/affiliate-programs" />}>
            <CompassIcon className="size-4" aria-hidden /> Discover programs
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Clicks" value={stats.clicks} hint="Tracked by Refnivo" icon={MousePointerClickIcon} />
        <KpiCard label="Unique visitors" value={stats.uniqueVisitors} icon={UsersIcon} />
        <KpiCard label="Top platform" value={stats.bySource[0] ? SOURCE_LABEL[stats.bySource[0].source] : "—"} hint={stats.bySource[0] ? `${stats.bySource[0].clicks} ${stats.bySource[0].clicks === 1 ? "click" : "clicks"}` : "No clicks yet"} />
        <KpiCard label="Sales & commission" value="External" hint="Recorded by each affiliate programme" />
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-2 text-sm">
          <InfoIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Refnivo currently tracks clicks.</span> Sales, commission and payment for these programmes are handled by
            each external affiliate program — check their dashboards. When a programme connects a verified sales feed, the figures will appear here.
          </p>
        </CardContent>
      </Card>

      {!active.length ? (
        <EmptyState
          icon={LinkIcon}
          title="No affiliate links yet"
          description="Find a programme, join it on the brand's site, then come back and add the affiliate link they give you."
          action={
            <Button size="sm" nativeButton={false} render={<Link href="/affiliate-programs" />}>
              Discover affiliate programs
            </Button>
          }
        />
      ) : (
        active.map((link) => (
          <Card key={link.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{link.program.brand.name}</CardTitle>
                <ProgramTypeBadge type="EXTERNAL" />
                {link.program.status !== "APPROVED" ? <StatusBadge status="PAUSED" label="Paused by the brand" /> : null}
              </div>
              <CardDescription>
                {link.program.name}
                {link.program.commissionDescription ? ` · Commission (paid by the programme): ${link.program.commissionDescription}` : ""}
              </CardDescription>
              <p className="truncate text-xs text-muted-foreground">
                Forwards to your affiliate link: <span className="font-mono">{link.targetUrl}</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {cards
                  .filter((c) => c.link.id === link.id)
                  .map((c) => (
                    <div key={c.code.id} className="space-y-1">
                      <p className="text-xs font-semibold text-indigo-600">
                        {SOURCE_LABEL[c.code.source]} link · {c.code._count.clicks} {c.code._count.clicks === 1 ? "click" : "clicks"}
                      </p>
                      <ReferralLinkCard
                        code={c.code.code}
                        url={c.url}
                        qrDataUrl={c.qr}
                        share={shareTargets(c.url, `${link.program.brand.name} — ${link.program.name}`)}
                        shareText={`${link.program.brand.name} — ${link.program.name}`}
                        compact
                      />
                    </div>
                  ))}
              </div>
              <AffiliateLinkControls linkId={link.id} existing={link.codes.map((c) => c.source)} />
            </CardContent>
          </Card>
        ))
      )}

      {stats.byProgram.length ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clicks by programme</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {stats.byProgram.map((p) => (
                <li key={p.programId} className="flex justify-between py-2">
                  <span>{p.name}</span>
                  <span className="tabular-nums">{p.clicks}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
