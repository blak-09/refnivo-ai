import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy" intro="We collect the minimum data needed to run referral programs fairly.">
      <h2>What we store</h2>
      <ul>
        <li>Account details you provide: name, email, optional phone, and a hashed password.</li>
        <li>Brand, product and creator profile information you choose to publish.</li>
        <li>Referral activity: link clicks (with an anonymous visitor id and a hashed IP), referrals, and verified conversions.</li>
        <li>Ledger entries: rewards, commissions and payout requests.</li>
      </ul>
      <h2>What we do not do</h2>
      <ul>
        <li>We do not store raw IP addresses or precise device fingerprints.</li>
        <li>We do not show brands or partners the contact details of referred shoppers.</li>
        <li>We do not send personal data to AI providers — AI prompts contain campaign and aggregate metrics only.</li>
      </ul>
      <h2>Your choices</h2>
      <p>You can update or delete your profile from your dashboard, or contact us to request removal of your account.</p>
    </ProsePage>
  );
}
