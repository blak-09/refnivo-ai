import { ChevronDownIcon } from "lucide-react";

/**
 * Homepage FAQ. Native <details>/<summary>: keyboard and screen-reader
 * accessible, works without JavaScript, and adds no client code.
 * Every answer describes how the product works today.
 */
export const HOME_FAQ: { q: string; a: string }[] = [
  {
    q: "How does order verification work?",
    a: "When someone buys through a partner's link or QR code, the order is recorded against that partner. The brand then checks it against its own store and confirms or rejects it. Only confirmed orders create a commission or reward — a click on its own never does.",
  },
  {
    q: "When do creators get paid?",
    a: "Once a brand verifies an order, the commission becomes approved. When your approved balance reaches the minimum shown in your dashboard, you can request a payout. Each request is reviewed and settled to the UPI ID or bank account you choose, and the payment reference is recorded for you to see.",
  },
  {
    q: "What is an attribution window?",
    a: "It is how long after a click an order still counts for the partner who shared the link. The brand sets it for each campaign — 30 days by default.",
  },
  {
    q: "Who pays the commission?",
    a: "The brand sets the creator commission and the customer reward for each campaign and pays them for verified orders. Creators and customers never pay to join a campaign.",
  },
  {
    q: "Is Refnivo free?",
    a: "Yes, during early access. Paid plans will be announced in advance, and nothing changes for existing brands without their agreement.",
  },
  {
    q: "Do customers need followers to earn?",
    a: "No. Anyone with a customer account can share a personal link with friends and family and earn the reward once the brand verifies the order.",
  },
  {
    q: "How are disagreements about an order handled?",
    a: "Both the brand and the partner see every order and its status. If an order is refunded, the related commission is reversed automatically, and every change to money is recorded in an audit log, so our team can review any disagreement. Just contact us.",
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
