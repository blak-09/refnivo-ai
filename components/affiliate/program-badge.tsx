import { BadgeCheckIcon, ExternalLinkIcon, MegaphoneIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one visual that tells a creator who runs a programme.
 *  - REFNIVO CAMPAIGN: managed on Refnivo — Refnivo tracks the sale and the ledger.
 *  - EXTERNAL AFFILIATE PROGRAM: the brand's own programme elsewhere — approval,
 *    commission and payment all happen there; Refnivo only helps you find it
 *    and counts your clicks.
 */
export function ProgramTypeBadge({ type, className }: { type: "REFNIVO" | "EXTERNAL"; className?: string }) {
  const external = type === "EXTERNAL";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase",
        external ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" : "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200",
        className,
      )}
    >
      {external ? <ExternalLinkIcon className="size-3" aria-hidden /> : <MegaphoneIcon className="size-3" aria-hidden />}
      {external ? "External affiliate program" : "Refnivo campaign"}
    </span>
  );
}

/** Shown only when an admin actually checked the brand and both URLs. */
export function VerifiedProgramMark({ verifiedAt }: { verifiedAt: Date | null }) {
  if (!verifiedAt) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600" title="Refnivo reviewed the official program page and URL. This is not a guarantee of the program.">
      <BadgeCheckIcon className="size-3.5" aria-hidden /> Verified by Refnivo
    </span>
  );
}

export const APPROVAL_LABEL = { AUTOMATIC: "Automatic approval", APPLICATION: "Application required", INVITE_ONLY: "Invite only" } as const;
export const COMMISSION_TYPE_LABEL = { PERCENTAGE: "Percentage", FIXED: "Fixed amount", VARIES: "Varies by product" } as const;

/** "Active" is only ever shown for published (APPROVED) listings. */
export function ActiveProgramPill({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300", className)}>
      <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> Active
    </span>
  );
}

/** Shown when a programme does not publish its commission — never a guessed figure. */
export const NOT_DISCLOSED = "See program terms";
export const OPEN_ELIGIBILITY = "Open application / subject to program approval";

/** Commission as the programme states it — never a Refnivo figure, never guessed. */
export function commissionText(p: { commissionDescription: string | null; commissionType: keyof typeof COMMISSION_TYPE_LABEL | null }): string {
  if (p.commissionDescription) return p.commissionDescription;
  if (p.commissionType === "VARIES") return "Varies by category";
  return NOT_DISCLOSED;
}

export function eligibilityText(p: { requirements: string | null }): string {
  return p.requirements?.trim() || OPEN_ELIGIBILITY;
}

/** Wording for the join button: a direct application page vs. an informational one. */
export function joinLabel(programType: string): string {
  return programType === "REFERRAL" ? "Visit program" : "Join program";
}

export const EXTERNAL_DETAILS_NOTE = "Program details may change — verify on the official program page.";
