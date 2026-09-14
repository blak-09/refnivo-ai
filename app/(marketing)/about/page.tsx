import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <ProsePage
      title="About Refnivo AI"
      intro="Levanta-style affiliate infrastructure for product brands — with both creators and everyday customers as referral partners."
    >
      <h2>Why we exist</h2>
      <p>
        Brands know creators and word of mouth sell products, but the tracking, verification and payouts behind that are
        messy. Marketplaces own the customer relationship and charge for it. Refnivo AI gives every brand its own
        affiliate network: creators and customers share unique links and QR codes, the brand verifies the orders, and
        commissions and rewards are tracked in a transparent ledger.
      </p>
      <h2>What we are not</h2>
      <ul>
        <li>Not an influencer talent agency.</li>
        <li>Not a loyalty points app.</li>
        <li>Not an online store — orders happen on the brand&apos;s own website.</li>
      </ul>
      <h2>Where we are</h2>
      <p>
        We are India-first and in MVP: order recording is manual, payouts are processed by our team, creator audience
        numbers are self-reported, and AI features assist without ever controlling money.
      </p>
    </ProsePage>
  );
}
