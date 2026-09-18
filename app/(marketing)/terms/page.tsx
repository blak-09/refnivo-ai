import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = { title: "Terms" };

export default function TermsPage() {
  return (
    <ProsePage title="Terms of use" intro="Plain-language terms for using Refnivo AI.">
      <h2>Campaigns and rewards</h2>
      <ul>
        <li>Brands define and fund their own creator commissions and customer referral rewards.</li>
        <li>A referral becomes eligible only after the brand verifies a qualifying order.</li>
        <li>Self-referrals, duplicate referrals and duplicate order references may be rejected.</li>
      </ul>
      <h2>Payouts</h2>
      <p>
        Creators can request a payout once their approved commissions reach the minimum threshold. Payouts are reviewed and
        processed manually by the Refnivo AI team; there is no automatic UPI payout in this version.
      </p>
      <h2>Accounts</h2>
      <p>Accounts that abuse the referral system may be suspended. Decisions are recorded in an audit log.</p>
    </ProsePage>
  );
}
