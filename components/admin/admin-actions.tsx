"use client";

import { BanIcon, CheckIcon, PauseIcon, RotateCcwIcon, ShieldCheckIcon, ShieldOffIcon, SquareIcon, ArchiveIcon, XIcon, WalletIcon, SearchIcon } from "lucide-react";
import { moderateCampaignAction, payoutReviewAction, reactivateUserAction, suspendUserAction, verificationAction } from "@/app/actions/admin";
import { ConfirmAction } from "@/components/shared/confirm-action";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function UserStatusActions({ userId, status, isSelf }: { userId: string; status: string; isSelf: boolean }) {
  if (isSelf) return <span className="text-xs text-muted-foreground">You</span>;
  if (status === "APPROVED") {
    return (
      <ConfirmAction
        label={
          <>
            <BanIcon /> Suspend
          </>
        }
        variant="outline"
        title="Suspend this account?"
        description="The user is signed out everywhere immediately and cannot log in until reactivated. The reason is shown to them."
        input={{ label: "Reason", placeholder: "e.g. policy violation", required: true }}
        confirmLabel="Suspend"
        successMessage="Account suspended."
        run={(reason) => suspendUserAction({ userId, reason })}
      />
    );
  }
  if (status === "SUSPENDED") {
    return (
      <ConfirmAction
        label={
          <>
            <RotateCcwIcon /> Reactivate
          </>
        }
        variant="outline"
        title="Reactivate this account?"
        description="The user will be able to sign in again."
        confirmLabel="Reactivate"
        successMessage="Account reactivated."
        run={() => reactivateUserAction({ userId })}
      />
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export function VerificationActions({ target, id, status }: { target: "BRAND" | "CREATOR"; id: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "VERIFIED" ? (
        <ConfirmAction
          label={
            <>
              <ShieldCheckIcon /> Verify
            </>
          }
          variant="default"
          title={`Mark this ${target.toLowerCase()} as verified?`}
          description="A verified badge is shown publicly. The owner is notified."
          input={{ label: "Note to the owner (optional)" }}
          confirmLabel="Verify"
          successMessage="Marked as verified."
          run={(note) => verificationAction({ target, id, decision: "VERIFIED", note })}
        />
      ) : null}
      {status !== "REJECTED" ? (
        <ConfirmAction
          label={
            <>
              <XIcon /> Decline
            </>
          }
          variant="outline"
          title="Decline verification?"
          description="The owner is notified with your note so they can fix the issue and try again."
          input={{ label: "What is missing?", placeholder: "e.g. website does not match the brand", required: true }}
          confirmLabel="Decline"
          successMessage="Verification declined."
          run={(note) => verificationAction({ target, id, decision: "REJECTED", note })}
        />
      ) : null}
      {status === "VERIFIED" ? (
        <ConfirmAction
          label={
            <>
              <ShieldOffIcon /> Revoke
            </>
          }
          variant="outline"
          title="Revoke verification?"
          description="The verified badge is removed. The owner is notified."
          input={{ label: "Reason", required: true }}
          confirmLabel="Revoke"
          successMessage="Verification revoked."
          run={(note) => verificationAction({ target, id, decision: "UNVERIFIED", note })}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign moderation
// ---------------------------------------------------------------------------

export function CampaignModeration({ campaignId, status }: { campaignId: string; status: string }) {
  const can = (a: "PAUSE" | "END" | "ARCHIVE") =>
    a === "PAUSE" ? status === "ACTIVE" : a === "END" ? status === "ACTIVE" || status === "PAUSED" : ["DRAFT", "PAUSED", "ENDED"].includes(status);
  return (
    <div className="flex flex-wrap gap-2">
      {can("PAUSE") ? (
        <ConfirmAction
          label={
            <>
              <PauseIcon /> Pause
            </>
          }
          title="Pause this campaign?"
          description="Referral links stop resolving until the brand resumes it. The brand owner is notified with your reason."
          input={{ label: "Reason", required: true }}
          confirmLabel="Pause"
          successMessage="Campaign paused."
          run={(reason) => moderateCampaignAction({ campaignId, action: "PAUSE", reason })}
        />
      ) : null}
      {can("END") ? (
        <ConfirmAction
          label={
            <>
              <SquareIcon /> End
            </>
          }
          title="End this campaign?"
          description="This is final: the campaign cannot be resumed. The brand owner is notified."
          input={{ label: "Reason", required: true }}
          confirmLabel="End campaign"
          variant="destructive"
          successMessage="Campaign ended."
          run={(reason) => moderateCampaignAction({ campaignId, action: "END", reason })}
        />
      ) : null}
      {can("ARCHIVE") ? (
        <ConfirmAction
          label={
            <>
              <ArchiveIcon /> Archive
            </>
          }
          title="Archive this campaign?"
          description="Hidden from the marketplace and the brand's active list."
          input={{ label: "Reason", required: true }}
          confirmLabel="Archive"
          successMessage="Campaign archived."
          run={(reason) => moderateCampaignAction({ campaignId, action: "ARCHIVE", reason })}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payout review
// ---------------------------------------------------------------------------

export function PayoutReview({ payoutId, status }: { payoutId: string; status: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {status === "REQUESTED" ? (
        <ConfirmAction
          label={
            <>
              <SearchIcon /> Review
            </>
          }
          title="Mark as under review"
          description="Lets the requester know you are looking at it."
          confirmLabel="Under review"
          successMessage="Marked under review."
          run={() => payoutReviewAction({ payoutId, action: "UNDER_REVIEW" })}
          immediate
        />
      ) : null}
      {["REQUESTED", "UNDER_REVIEW", "FAILED"].includes(status) ? (
        <ConfirmAction
          label={
            <>
              <CheckIcon /> Approve
            </>
          }
          variant="default"
          title="Approve this request?"
          description="Approval means the platform will settle it off-platform. Nothing is paid until you mark it paid with a reference."
          input={{ label: "Note to the requester (optional)" }}
          confirmLabel="Approve"
          successMessage="Request approved."
          run={(note) => payoutReviewAction({ payoutId, action: "APPROVE", note })}
        />
      ) : null}
      {["APPROVED", "PROCESSING"].includes(status) ? (
        <ConfirmAction
          label={
            <>
              <WalletIcon /> Mark paid
            </>
          }
          variant="default"
          title="Record the settlement"
          description="Enter the external reference (UPI/bank transaction id or voucher code) for the transfer you made outside the platform. The linked commissions/rewards become PAID/REDEEMED."
          input={{ label: "Settlement reference", placeholder: "e.g. UPI txn 4123…", required: true }}
          confirmLabel="Mark as paid"
          successMessage="Payout recorded as settled."
          run={(reference) => payoutReviewAction({ payoutId, action: "MARK_PAID", reference })}
        />
      ) : null}
      {["APPROVED", "PROCESSING"].includes(status) ? (
        <ConfirmAction
          label={
            <>
              <XIcon /> Failed
            </>
          }
          title="Mark the settlement as failed?"
          description="Use when the transfer bounced. The request can be approved again after the requester fixes their details."
          input={{ label: "What went wrong?", required: true }}
          confirmLabel="Mark failed"
          successMessage="Marked as failed."
          run={(note) => payoutReviewAction({ payoutId, action: "FAIL", note })}
        />
      ) : null}
      {["REQUESTED", "UNDER_REVIEW", "APPROVED", "FAILED"].includes(status) ? (
        <ConfirmAction
          label={
            <>
              <BanIcon /> Decline
            </>
          }
          variant="destructive"
          title="Decline this request?"
          description="The commissions/rewards are released and can be requested again later. The reason is shown to the requester."
          input={{ label: "Reason", required: true }}
          confirmLabel="Decline"
          successMessage="Request declined."
          run={(note) => payoutReviewAction({ payoutId, action: "REJECT", note })}
        />
      ) : null}
    </div>
  );
}
