import Link from "next/link";
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
        Creators can request a payout once their approved commissions reach the minimum threshold. Every request is reviewed by the
        Refnivo AI team and then paid to the UPI ID or bank account you choose; the bank reference is recorded on the request.
      </p>
      <h2>Payments and refunds</h2>
      <p>
        Plan payments and wallet top-ups are processed by Razorpay. Refunds and cancellations are covered by our{" "}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
      </p>
      <h2>Accounts</h2>
      <p>Accounts that abuse the referral system may be suspended. Decisions are recorded in an audit log.</p>
    </ProsePage>
  );
}
