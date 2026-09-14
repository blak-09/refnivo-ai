import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <ProsePage title="Contact" intro="We are a small team working closely with early brands and creators.">
      <h2>Brands &amp; creators</h2>
      <p>
        Email <a className="font-medium text-primary underline-offset-4 hover:underline" href="mailto:hello@refnivo.ai">hello@refnivo.ai</a> with your
        brand or creator profile. We onboard new brands and creators in batches.
      </p>
      <h2>Support &amp; disputes</h2>
      <p>
        Logged-in users can raise verification or payout questions from their dashboard. Every decision on a referral or
        payout is recorded in an audit log so it can be reviewed.
      </p>
    </ProsePage>
  );
}
