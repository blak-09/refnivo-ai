import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, StatusBadge } from "@/components/dashboard/primitives";
import { BrandLogo } from "@/components/products/product-thumb";
import { ApplyForm, ConfirmPayment, SubmitContentForm, WithdrawApplication } from "@/components/ugc/creator-actions";
import { BriefFacts, LinkList, SubmissionList } from "@/components/ugc/parts";
import { requireCreator } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getCreatorBrief } from "@/lib/services/ugc";
import { uploadsAvailable } from "@/lib/storage";
import { UGC_COLLAB_STATUS_LABEL, UGC_MAX_ROUNDS, ugcCollabTone } from "@/lib/ugc/options";
import { formatDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "UGC brief" };

export default async function CreatorBriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireCreator();
  const data = await getCreatorBrief(user.id, id);
  if (!data) notFound();
  const { brief, collab } = data;
  const fee = formatMoney(collab?.agreedFee ?? brief.feeAmount, brief.currency);
  const deadlinePassed = !!brief.applyBy && brief.applyBy < new Date();
  const canApply = brief.status === "OPEN" && !deadlinePassed && (!collab || collab.status === "WITHDRAWN");
  const roundsLeft = UGC_MAX_ROUNDS - (collab?.submissions.length ?? 0);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/creator/ugc" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" aria-hidden /> All briefs
      </Link>
      <div className="flex items-start gap-4">
        <BrandLogo src={brief.brand.logoUrl} name={brief.brand.name} className="size-14" />
        <div className="min-w-0 flex-1">
          <PageHeader
            title={brief.title}
            description={
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/brands/${brief.brand.slug}`} className="hover:underline">
                  {brief.brand.name}
                </Link>
                {brief.brand.industry ? <span>· {brief.brand.industry}</span> : null}
                {collab ? <StatusBadge status={ugcCollabTone(collab.status)} label={UGC_COLLAB_STATUS_LABEL[collab.status]} /> : null}
              </span>
            }
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>The brief</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <BriefFacts brief={{ ...brief, feeAmount: collab?.agreedFee ?? brief.feeAmount }} />
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">The idea</h3>
              <p className="mt-1 text-sm whitespace-pre-line">{brief.description}</p>
            </div>
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">What you deliver</h3>
              <p className="mt-1 text-sm whitespace-pre-line">{brief.deliverables}</p>
            </div>
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              The brand pays you directly once they approve your content, then marks it paid here and you confirm. Refnivo does not hold or deduct anything from UGC fees. Each collaboration includes the first delivery and up to two revision rounds.
            </p>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {canApply ? (
            <Card>
              <CardHeader>
                <CardTitle>{collab?.status === "WITHDRAWN" ? "Apply again" : `Apply for ${fee}`}</CardTitle>
              </CardHeader>
              <CardContent>
                <ApplyForm briefId={brief.id} />
              </CardContent>
            </Card>
          ) : null}

          {!collab && !canApply ? (
            <Card>
              <CardContent className="text-sm text-muted-foreground">{deadlinePassed ? "The application deadline has passed." : "This brief is not taking applications."}</CardContent>
            </Card>
          ) : null}

          {collab && collab.status !== "WITHDRAWN" ? (
            <Card>
              <CardHeader>
                <CardTitle>Your collaboration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusText status={collab.status} deliverBy={brief.deliverBy} roundsLeft={roundsLeft} />
                {collab.brandNote ? (
                  <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                    <span className="block text-xs font-medium text-muted-foreground">Message from {brief.brand.name}</span>
                    <span className="whitespace-pre-line">{collab.brandNote}</span>
                  </p>
                ) : null}
                {collab.status === "APPLIED" ? (
                  <>
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground">Your pitch</h3>
                      <p className="mt-1 text-sm whitespace-pre-line">{collab.pitch}</p>
                    </div>
                    <LinkList links={collab.portfolioLinks} />
                    <WithdrawApplication collabId={collab.id} />
                  </>
                ) : null}
                {collab.status === "APPROVED" ? (
                  collab.paidConfirmedAt ? (
                    <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
                      <CheckCircle2Icon className="size-4" aria-hidden /> You confirmed receiving {fee} on {formatDate(collab.paidConfirmedAt)}.
                    </p>
                  ) : collab.paidMarkedAt ? (
                    <div className="space-y-2 rounded-xl border p-3">
                      <p className="text-sm">
                        {brief.brand.name} marked {fee} as paid on {formatDate(collab.paidMarkedAt)}
                        {collab.paymentReference ? ` (Ref ${collab.paymentReference})` : ""}. Check your account, then confirm.
                      </p>
                      <ConfirmPayment collabId={collab.id} amountLabel={fee} />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      {brief.brand.name} owes you {fee}. They will mark it paid here once they send it.
                    </p>
                  )
                ) : null}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {collab && (collab.status === "IN_PROGRESS" || collab.status === "REVISION_REQUESTED") ? (
        <Card>
          <CardHeader>
            <CardTitle>{collab.status === "REVISION_REQUESTED" ? "Send your revision" : "Deliver your content"}</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmitContentForm collabId={collab.id} uploadsEnabled={uploadsAvailable()} revision={collab.status === "REVISION_REQUESTED"} />
          </CardContent>
        </Card>
      ) : null}

      {collab?.submissions.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Your deliveries</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionList submissions={collab.submissions} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatusText({ status, deliverBy, roundsLeft }: { status: string; deliverBy: Date | null; roundsLeft: number }) {
  const text: Record<string, string> = {
    APPLIED: "Your application is with the brand. You will be notified when they decide.",
    DECLINED: "The brand did not select you for this brief. Keep an eye out for other briefs.",
    IN_PROGRESS: `You're in! Create the content and send it below${deliverBy ? ` by ${formatDate(deliverBy)}` : ""}.`,
    SUBMITTED: "Your content is with the brand for review.",
    REVISION_REQUESTED: `The brand asked for changes. ${roundsLeft === 1 ? "This is the final round." : `${roundsLeft} rounds left.`}`,
    APPROVED: "The brand approved your content.",
    CANCELLED: "The brand cancelled this collaboration before delivery. No content is owed.",
  };
  return <p className="text-sm">{text[status] ?? ""}</p>;
}
