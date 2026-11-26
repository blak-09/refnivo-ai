import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard, StatusBadge } from "@/components/dashboard/primitives";
import { DeletePartnerNote, PartnerNoteForm } from "@/components/partners/partner-notes";
import { PersonAvatar, creatorName } from "@/components/ugc/parts";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getBrandPartner } from "@/lib/services/partnerships";
import { UGC_COLLAB_STATUS_LABEL, ugcCollabTone } from "@/lib/ugc/options";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Partner" };

const compact = (n: number | null | undefined) => (n ? new Intl.NumberFormat("en-IN", { notation: "compact" }).format(n) : null);

export default async function PartnerPage({ params }: { params: Promise<{ creatorId: string }> }) {
  const { creatorId } = await params;
  const { brand } = await requireBrand();
  const partner = await getBrandPartner(brand.id, creatorId);
  if (!partner) notFound();
  const { creator, stats } = partner;
  const p = creator.creatorProfile;
  const name = creatorName(creator);
  const audience = [compact(p?.instagramFollowers) && `${compact(p?.instagramFollowers)} Instagram`, compact(p?.youtubeSubscribers) && `${compact(p?.youtubeSubscribers)} YouTube`].filter(Boolean);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/brand/partners" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All partners
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <PersonAvatar src={p?.profileImageUrl} name={name} className="size-16" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{name}</h1>
            <p className="text-sm text-muted-foreground">{[p?.username ? `@${p.username}` : null, p?.category, p?.location].filter(Boolean).join(" · ")}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge variant="secondary">Partner since {formatDate(partner.since)}</Badge>
              {partner.connection?.status === "ACCEPTED" ? <Badge variant="secondary">Connected</Badge> : null}
              {p?.verificationStatus === "VERIFIED" ? <Badge variant="secondary">Verified creator</Badge> : null}
              {audience.length ? <Badge variant="outline">{audience.join(" · ")} (self-reported)</Badge> : null}
            </div>
          </div>
        </div>
        {p?.username ? (
          <Link href={`/creators/${p.username}`} target="_blank" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
            Public profile <ExternalLinkIcon className="size-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Clicks" value={stats.clicks} hint={`${stats.campaigns} campaign${stats.campaigns === 1 ? "" : "s"}`} />
        <KpiCard label="Verified sales" value={stats.verified} hint={`${formatMoney(stats.revenue)} in sales`} />
        <KpiCard label="Commission" value={formatMoney(stats.commission)} hint={`${formatMoney(stats.commissionPaid)} paid out`} />
        <KpiCard label="UGC" value={stats.ugc} hint={`${formatMoney(stats.ugcFees)} in approved fees`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {!partner.campaigns.length ? (
                <p className="text-sm text-muted-foreground">No campaign applications from this creator yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table stackOnMobile>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Application</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Verified</TableHead>
                        <TableHead className="text-right">Sales value</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partner.campaigns.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="max-w-56">
                            <Link href={`/dashboard/brand/campaigns/${a.campaign.id}`} className="block truncate font-medium hover:underline">
                              {a.campaign.name}
                            </Link>
                            {a.campaign.product ? <span className="block truncate text-xs text-muted-foreground">{a.campaign.product.name}</span> : null}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={a.status} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{a.results.clicks}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.results.verified}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(a.results.revenue)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatMoney(a.results.commission)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>UGC collaborations</CardTitle>
            </CardHeader>
            <CardContent>
              {!partner.ugc.length ? (
                <p className="text-sm text-muted-foreground">No UGC work with this creator yet.</p>
              ) : (
                <ul className="divide-y">
                  {partner.ugc.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <Link href={`/dashboard/brand/ugc/${u.brief.id}`} className="block truncate font-medium hover:underline">
                          {u.brief.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {formatMoney(u.agreedFee ?? u.brief.feeAmount)} · updated {formatDate(u.updatedAt)}
                          {u.paidConfirmedAt ? " · payment confirmed" : u.paidMarkedAt ? " · marked paid" : ""}
                        </span>
                      </div>
                      <StatusBadge status={ugcCollabTone(u.status)} label={UGC_COLLAB_STATUS_LABEL[u.status]} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Private notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PartnerNoteForm creatorId={creator.id} />
            {partner.notes.length ? (
              <ul className="space-y-3">
                {partner.notes.map((n) => (
                  <li key={n.id} className="rounded-xl border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm whitespace-pre-line">{n.body}</p>
                      <DeletePartnerNote noteId={n.id} creatorId={creator.id} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.author.name ?? "Your team"} · {formatDateTime(n.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
