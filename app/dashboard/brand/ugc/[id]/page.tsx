import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon, InboxIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { ApplicantActions, BriefStatusActions, CancelCollaboration, MarkPaidForm, ReviewForm } from "@/components/ugc/brand-actions";
import { BriefFacts, CreatorLine, LinkList, SubmissionList } from "@/components/ugc/parts";
import { requireBrand } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getBrandEntitlements } from "@/lib/services/plan-limits";
import { briefActions, getBrandBrief } from "@/lib/services/ugc";
import { UGC_ACTIVE_STATUSES, UGC_BRIEF_STATUS_LABEL, UGC_COLLAB_STATUS_LABEL, UGC_MAX_ROUNDS, ugcBriefTone, ugcCollabTone } from "@/lib/ugc/options";
import { formatDate, formatDateTime } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "UGC brief" };

const ACTIVE: readonly string[] = UGC_ACTIVE_STATUSES;

export default async function BrandBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { brand } = await requireBrand();
  const [brief, entitlements] = await Promise.all([getBrandBrief(brand.id, id), getBrandEntitlements(brand.id)]);
  if (!brief) notFound();

  const applicants = brief.collaborations.filter((c) => c.status === "APPLIED");
  const working = brief.collaborations.filter((c) => ACTIVE.includes(c.status));
  const past = brief.collaborations.filter((c) => !ACTIVE.includes(c.status) && c.status !== "APPLIED");
  const slotsLeft = Math.max(0, brief.creatorsNeeded - working.length);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/brand/ugc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All briefs
      </Link>
      <PageHeader
        title={brief.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ugcBriefTone(brief.status)} label={UGC_BRIEF_STATUS_LABEL[brief.status]} />
            {brief.publishedAt ? <span>Published {formatDate(brief.publishedAt)}</span> : <span>Not published yet. Creators cannot see drafts.</span>}
          </span>
        }
        actions={
          <BriefStatusActions
            briefId={brief.id}
            actions={briefActions(brief.status)}
            editable={brief.status === "DRAFT" || brief.status === "OPEN"}
            planRequired={!entitlements.features.ugc}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Brief</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <BriefFacts brief={brief} slotsLeft={slotsLeft} />
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">The idea</h3>
              <p className="mt-1 text-sm whitespace-pre-line">{brief.description}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">Deliverables per creator</h3>
              <p className="mt-1 text-sm whitespace-pre-line">{brief.deliverables}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Applications <span className="text-sm font-normal text-muted-foreground">({applicants.length})</span>
        </h2>
        {!applicants.length ? (
          <p className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            <InboxIcon className="size-4" aria-hidden />
            {brief.status === "OPEN" ? "No pending applications. Creators who apply show up here." : "No pending applications."}
          </p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {applicants.map((c) => (
              <Card key={c.id}>
                <CardContent className="space-y-3">
                  <CreatorLine creator={c.creator} href={c.creator.creatorProfile?.username ? `/creators/${c.creator.creatorProfile.username}` : undefined} />
                  <p className="text-sm whitespace-pre-line">{c.pitch}</p>
                  <LinkList links={c.portfolioLinks} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">Applied {formatDateTime(c.createdAt)}</span>
                    <ApplicantActions collabId={c.id} slotsLeft={slotsLeft} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Creators working on this{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({working.length} of {brief.creatorsNeeded})
          </span>
        </h2>
        {!working.length ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Accept an application to start a collaboration.</p>
        ) : (
          working.map((c) => {
            const fee = formatMoney(c.agreedFee ?? brief.feeAmount, brief.currency);
            return (
              <Card key={c.id}>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <CreatorLine creator={c.creator} href={`/dashboard/brand/partners/${c.creator.id}`} />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={ugcCollabTone(c.status)} label={UGC_COLLAB_STATUS_LABEL[c.status]} />
                      <span className="text-sm font-medium">{fee}</span>
                    </div>
                  </div>
                  {c.status === "IN_PROGRESS" ? (
                    <p className="text-sm text-muted-foreground">Waiting for the first delivery{brief.deliverBy ? ` (due ${formatDate(brief.deliverBy)})` : ""}.</p>
                  ) : null}
                  {c.status === "REVISION_REQUESTED" ? <p className="text-sm text-muted-foreground">Waiting for the revised content.</p> : null}
                  <SubmissionList submissions={c.submissions} />
                  {c.status === "SUBMITTED" ? <ReviewForm collabId={c.id} finalRound={c.submissions.length >= UGC_MAX_ROUNDS} /> : null}
                  {c.status === "APPROVED" ? <PaymentState collab={c} fee={fee} /> : null}
                  {c.status === "IN_PROGRESS" || c.status === "REVISION_REQUESTED" ? (
                    <div className="flex justify-end">
                      <CancelCollaboration collabId={c.id} />
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      {past.length ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Closed applications</h2>
          <Card>
            <CardContent className="divide-y">
              {past.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <CreatorLine creator={c.creator} compact />
                  <StatusBadge status={ugcCollabTone(c.status)} label={UGC_COLLAB_STATUS_LABEL[c.status]} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}

function PaymentState({ collab, fee }: { collab: { id: string; paidMarkedAt: Date | null; paymentReference: string | null; paidConfirmedAt: Date | null }; fee: string }) {
  if (collab.paidConfirmedAt) {
    return (
      <p className="flex flex-wrap items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
        <CheckCircle2Icon className="size-4" aria-hidden /> Paid {fee}. Confirmed by the creator on {formatDate(collab.paidConfirmedAt)}
        {collab.paymentReference ? ` · Ref ${collab.paymentReference}` : ""}
      </p>
    );
  }
  if (collab.paidMarkedAt) {
    return (
      <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
        You marked {fee} as paid on {formatDate(collab.paidMarkedAt)}
        {collab.paymentReference ? ` (Ref ${collab.paymentReference})` : ""}. Waiting for the creator to confirm they received it.
      </p>
    );
  }
  return <MarkPaidForm collabId={collab.id} amountLabel={fee} />;
}
