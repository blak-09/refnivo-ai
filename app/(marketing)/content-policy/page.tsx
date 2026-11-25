import Link from "next/link";
import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Content policy",
  description: "What brands can promote on Refnivo, and how campaigns are reviewed.",
};

export default function ContentPolicyPage() {
  return (
    <ProsePage title="Content policy" intro="What can be promoted on Refnivo, and how we review campaigns. Written so creators can trust every listing they share.">
      <h2>What Refnivo is for</h2>
      <p>
        Refnivo is for brands selling their own physical or digital products to consumers in India: fashion, beauty, food, home, electronics, wellness,
        accessories, courses and similar. Each campaign promotes one product the brand owns or is authorised to sell, at a real price, on the
        brand&apos;s own store.
      </p>

      <h2>Not allowed</h2>
      <ul>
        <li>Real estate, land, plots, vehicles and other high-value assets that are not bought online as a product.</li>
        <li>Financial products: loans, credit, trading, crypto, investment schemes, betting, gambling, lotteries and fantasy games for money.</li>
        <li>Medicines, prescription drugs, and health claims to cure, treat or prevent a disease. Wellness products may describe ingredients, not cures.</li>
        <li>Tobacco, vapes, alcohol, weapons, adult content, and anything illegal to sell in India.</li>
        <li>Products using someone else&apos;s trademark, characters or brand without permission (for example game, film or sports names on unlicensed goods).</li>
        <li>Counterfeit or replica goods, and listings whose price, offer or product does not match the brand&apos;s store.</li>
        <li>Multi-level marketing, &quot;earn from home&quot; schemes and campaigns that ask creators or customers to pay to join.</li>
      </ul>

      <h2>Campaign rules</h2>
      <ul>
        <li>The commission, customer reward, coupon code and terms shown on the campaign must be the ones the brand honours.</li>
        <li>A shopper offer must include the coupon code that works at checkout on the brand&apos;s store.</li>
        <li>Creators must disclose paid partnerships (#ad, &quot;Paid partnership&quot;) as Indian advertising guidelines require.</li>
      </ul>

      <h2>How review works</h2>
      <p>
        A brand&apos;s first campaign is checked by the Refnivo team before it goes live, usually within one business day. We may also review any later
        campaign. If something needs to change, the campaign goes back to drafts with the reason, and the brand can fix it and submit again. Live
        campaigns that break this policy can be paused or ended; the brand is told why, and every decision is recorded in an audit log.
      </p>

      <h2>Report a listing</h2>
      <p>
        See something that breaks these rules? <Link href="/contact">Contact us</Link> with the campaign link. Related terms: <Link href="/terms">Terms of use</Link>.
      </p>
    </ProsePage>
  );
}
