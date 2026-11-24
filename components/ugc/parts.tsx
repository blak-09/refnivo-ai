import { CalendarIcon, ExternalLinkIcon, IndianRupeeIcon, PackageIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { Picture } from "@/components/products/picture";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { UGC_CONTENT_TYPE_LABEL, UGC_USAGE_LABEL } from "@/lib/ugc/options";
import { formatDate, formatDateTime } from "@/lib/utils/dates";
import { cn } from "@/lib/utils";

export function PersonAvatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  const initials = (
    <span className="text-sm font-semibold text-primary">
      {name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()}
    </span>
  );
  return (
    <span className={cn("relative inline-flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-primary/10", className)}>
      {src ? <Picture src={src} alt={name} sizes="64px" fit="cover" fallback={initials} /> : initials}
    </span>
  );
}

type CreatorCard = {
  id: string;
  name: string | null;
  creatorProfile: { displayName: string; username: string; profileImageUrl: string | null; category: string | null; location: string | null } | null;
};

export function creatorName(creator: CreatorCard) {
  return creator.creatorProfile?.displayName || creator.name || "Creator";
}

/** Avatar, name and handle of a creator; links to `href` when given. */
export function CreatorLine({ creator, href, compact }: { creator: CreatorCard; href?: string; compact?: boolean }) {
  const p = creator.creatorProfile;
  const name = creatorName(creator);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar src={p?.profileImageUrl} name={name} className={compact ? "size-8" : undefined} />
      <div className="min-w-0">
        {href ? (
          <Link href={href} className="block truncate font-medium hover:underline">
            {name}
          </Link>
        ) : (
          <span className="block truncate font-medium">{name}</span>
        )}
        {!compact ? <p className="truncate text-xs text-muted-foreground">{[p?.username ? `@${p.username}` : null, p?.category, p?.location].filter(Boolean).join(" · ")}</p> : null}
      </div>
    </div>
  );
}

export function LinkList({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <ul className="space-y-1">
      {links.map((l) => (
        <li key={l} className="min-w-0">
          <a href={l} target="_blank" rel="noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 text-sm text-primary hover:underline">
            <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">{l}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

type BriefLike = {
  feeAmount: number;
  currency: string;
  creatorsNeeded: number;
  usageRights: string;
  usageNotes: string | null;
  contentTypes: string[];
  applyBy: Date | null;
  deliverBy: Date | null;
  productShipped: boolean;
  product?: { name: string } | null;
};

/** The terms of a brief, identical for the brand and the creator ("same transparent terms"). */
export function BriefFacts({ brief, slotsLeft }: { brief: BriefLike; slotsLeft?: number }) {
  const facts = [
    { icon: IndianRupeeIcon, label: "Fee per creator", value: formatMoney(brief.feeAmount, brief.currency) },
    { icon: UsersIcon, label: "Creators", value: slotsLeft === undefined ? String(brief.creatorsNeeded) : `${slotsLeft} of ${brief.creatorsNeeded} slots open` },
    { icon: ShieldCheckIcon, label: "Usage rights", value: UGC_USAGE_LABEL[brief.usageRights] ?? brief.usageRights },
    { icon: CalendarIcon, label: "Apply by", value: brief.applyBy ? formatDate(brief.applyBy) : "No deadline" },
    { icon: CalendarIcon, label: "Deliver by", value: brief.deliverBy ? formatDate(brief.deliverBy) : "Agree with the brand" },
    {
      icon: PackageIcon,
      label: "Product",
      value: brief.product ? `${brief.product.name}${brief.productShipped ? " · shipped to creators" : ""}` : brief.productShipped ? "Shipped to selected creators" : "Not included",
    },
  ];
  return (
    <div className="space-y-3">
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="flex items-start gap-2.5 rounded-xl border bg-card px-3 py-2.5">
            <f.icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0">
              <dt className="text-xs text-muted-foreground">{f.label}</dt>
              <dd className="text-sm font-medium">{f.value}</dd>
            </div>
          </div>
        ))}
      </dl>
      {brief.contentTypes.length ? (
        <div className="flex flex-wrap gap-1.5">
          {brief.contentTypes.map((t) => (
            <Badge key={t} variant="secondary">
              {UGC_CONTENT_TYPE_LABEL[t] ?? t}
            </Badge>
          ))}
        </div>
      ) : null}
      {brief.usageNotes ? <p className="text-xs text-muted-foreground">Usage notes: {brief.usageNotes}</p> : null}
    </div>
  );
}

type Submission = { id: string; round: number; note: string | null; imageUrls: string[]; links: string[]; decision: string | null; feedback: string | null; reviewedAt: Date | null; createdAt: Date };

export function SubmissionList({ submissions }: { submissions: Submission[] }) {
  if (!submissions.length) return null;
  return (
    <ol className="space-y-3">
      {[...submissions].reverse().map((s) => (
        <li key={s.id} className="rounded-xl border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{s.round === 1 ? "First delivery" : `Revision ${s.round - 1}`}</span>
            <span>{formatDateTime(s.createdAt)}</span>
          </div>
          {s.note ? <p className="mt-2 text-sm whitespace-pre-line">{s.note}</p> : null}
          {s.imageUrls.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {s.imageUrls.map((url, i) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded-lg border bg-muted" aria-label={`Open photo ${i + 1}`}>
                  <Picture src={url} alt={`Photo ${i + 1}`} sizes="160px" fit="cover" fallback={<span className="text-xs">Photo</span>} />
                </a>
              ))}
            </div>
          ) : null}
          {s.links.length ? (
            <div className="mt-3">
              <LinkList links={s.links} />
            </div>
          ) : null}
          {s.decision ? (
            <p className={cn("mt-3 rounded-lg px-3 py-2 text-sm", s.decision === "APPROVED" ? "bg-success/10 text-success" : "bg-warning/15 text-amber-900 dark:text-amber-100")}>
              <span className="font-medium">{s.decision === "APPROVED" ? "Approved" : "Changes requested"}</span>
              {s.feedback ? <span className="mt-0.5 block whitespace-pre-line">{s.feedback}</span> : null}
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
