import { ChevronDownIcon } from "lucide-react";

/**
 * Homepage FAQ. Native <details>/<summary>: keyboard and screen-reader
 * accessible, works without JavaScript, and adds no client code.
 * Every answer describes how the product works today.
 */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "What is Refnivo?",
    a: "A creator commerce platform for product brands. You can run affiliate and referral campaigns that pay commission only on verified orders, post UGC briefs that pay creators a fixed fee for approved content, and keep every creator partnership and its results in one place.",
  },
  {
    q: "How does order verification work?",
    a: "Refnivo does not read the brand's store automatically. An order counts when the brand records it with the partner's referral code, or when the buyer confirms their order number on the campaign page and the brand matches it in its store. Only orders the brand confirms create a commission or reward — a click on its own never does. Partners can see every order that is waiting for the brand, and for how long.",
  },
  {
    q: "When do creators get paid?",
    a: "Once a brand verifies an order, the commission is approved and the money is taken from the brand's Refnivo wallet. It becomes payable after the campaign's refund window (shown on every campaign, 14 days by default). When your payable balance reaches the minimum shown in your dashboard, request a payout: Refnivo reviews it, pays it to the UPI ID or bank account you choose and records the payment reference for you to see.",
  },
  {
    q: "What is an attribution window?",
    a: "It is how long after a click an order still counts for the partner who shared the link. The brand sets it for each campaign — 30 days by default.",
  },
  {
    q: "Who pays the commission?",
    a: "The brand. Brands add money to their Refnivo wallet; when a brand verifies an order, the commission or reward is taken from that wallet, so every approved commission is already funded. Refnivo then pays it to the creator or customer. Creators and customers never pay to join a campaign.",
  },
  {
    q: "Is Refnivo free?",
    a: "Brands can launch their first 3 campaigns free and use Partners on any plan. A plan from ₹999 per 30 days unlocks unlimited launches and UGC collaborations. Creators and customers never pay, and Refnivo takes no cut of their commission or UGC fees.",
  },
  {
    q: "How do UGC collaborations work?",
    a: "A brand posts a brief with the fee per creator, the deliverables and how it will use the content. Creators apply with a pitch, the brand picks who to work with, reviews the photos and videos (up to two revision rounds) and approves them. The brand then pays the creator directly and marks it paid; the creator confirms. Refnivo takes no cut. UGC briefs are part of the Starter and Growth plans.",
  },
  {
    q: "What does the Partners page show?",
    a: "Every creator a brand works with — through an approved campaign, an accepted connection or a UGC collaboration — with their clicks, verified sales, commission and content, plus private notes only the brand's team can see. It is included in every plan.",
  },
  {
    q: "Do customers need followers to earn?",
    a: "No. Anyone with a customer account can share a personal link with friends and family and earn the reward once the brand verifies the order.",
  },
  {
    q: "How are disagreements about an order handled?",
    a: "Both the brand and the partner see every order and its status. A brand can record a refund only during the campaign's refund window and before the money is paid out. If a partner thinks an order was wrongly rejected or refunded, they can contest it from their dashboard within 30 days; the Refnivo team reviews it and can reopen or reinstate the order. Every change to money is recorded in an audit log.",
  },
  {
    q: "Do creators need to label paid promotions?",
    a: "Yes. Indian advertising guidelines require influencers to disclose paid partnerships, so mark posts that carry your referral link as an ad, sponsored or paid promotion.",
  },
];

export function HomeFaq() {
  return (
    <div className="divide-y rounded-3xl border bg-card">
      {HOME_FAQ.map((item) => (
        <details key={item.q} className="group px-5 sm:px-7 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left text-base font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-lg">
            {item.q}
            <ChevronDownIcon className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <p className="-mt-1 pb-5 text-[15px] leading-7 text-muted-foreground">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
