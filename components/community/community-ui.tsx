import Link from "next/link";
import { ArrowRightIcon, Building2Icon, CheckIcon, SparklesIcon, UsersRoundIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunityJoinLink } from "@/components/community/join-link";
import { WhatsAppIcon } from "@/components/community/whatsapp-icon";
import { BRAND_CIRCLE, CREATOR_CIRCLE, type CommunityPlacement } from "@/lib/config/community";
import { cn } from "@/lib/utils";

/**
 * Building blocks for the Refnivo Network (community) — used by /community,
 * the homepage band, and the small circle callouts on creator/brand pages.
 * WhatsApp is only the joining mechanism: green appears on the WhatsApp mark,
 * never as the section's colour.
 */

const CIRCLES = {
  CREATOR: { ...CREATOR_CIRCLE, icon: SparklesIcon, accent: "from-brand-from to-brand-to", tint: "bg-accent text-primary" },
  BRAND: { ...BRAND_CIRCLE, icon: Building2Icon, accent: "from-primary to-brand-to", tint: "bg-brand-to/10 text-accent-foreground" },
} as const;

/** Primary join button (gradient, large tap target) that opens the WhatsApp invite. */
export function JoinButton({
  audience,
  placement,
  children,
  className,
  variant = "gradient",
}: {
  audience: "CREATOR" | "BRAND" | "GENERAL";
  placement: CommunityPlacement;
  children: React.ReactNode;
  className?: string;
  variant?: "gradient" | "outline" | "light";
}) {
  return (
    <Button
      size="lg"
      variant={variant === "outline" ? "outline" : variant === "light" ? "secondary" : "default"}
      nativeButton={false}
      render={<CommunityJoinLink audience={audience} placement={placement} />}
      className={cn(
        "h-12 gap-2 rounded-xl px-5 text-base font-semibold sm:h-11",
        variant === "gradient" &&
          "bg-gradient-brand text-white shadow-md shadow-primary/25 transition-[box-shadow,transform] hover:shadow-lg hover:shadow-primary/30 active:translate-y-px",
        variant === "outline" && "border-border bg-background shadow-xs hover:bg-muted",
        variant === "light" && "bg-white text-primary shadow-md hover:bg-accent",
        className,
      )}
    >
      <WhatsAppIcon className="size-5" />
      {children}
    </Button>
  );
}

/** "Refnivo Network" pill used above community headings. */
export function NetworkBadge({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold tracking-wider text-primary uppercase shadow-xs",
        className,
      )}
    >
      <UsersRoundIcon className="size-3.5" aria-hidden />
      Refnivo Network
    </p>
  );
}

/** Decorative network of nodes and links — pure SVG, no animation, hidden from assistive tech. */
export function NetworkPattern({ className }: { className?: string }) {
  const nodes: [number, number, number][] = [
    [40, 60, 5], [140, 30, 4], [230, 90, 6], [320, 40, 4], [90, 150, 4], [190, 190, 5], [300, 160, 4], [380, 120, 5], [30, 230, 3], [250, 250, 4], [360, 230, 3],
  ];
  const links: [number, number][] = [[0, 1], [1, 2], [2, 3], [0, 4], [4, 5], [5, 2], [2, 6], [6, 7], [3, 7], [4, 8], [5, 9], [6, 9], [9, 10], [7, 10]];
  return (
    <svg viewBox="0 0 400 280" className={cn("pointer-events-none", className)} aria-hidden focusable="false">
      <g stroke="currentColor" strokeOpacity="0.18" strokeWidth="1.2">
        {links.map(([a, b]) => (
          <line key={`${a}-${b}`} x1={nodes[a][0]} y1={nodes[a][1]} x2={nodes[b][0]} y2={nodes[b][1]} />
        ))}
      </g>
      <g fill="currentColor">
        {nodes.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} fillOpacity={i % 3 === 0 ? 0.45 : 0.25} />
        ))}
      </g>
    </svg>
  );
}

/** One circle card: who it is for, what members get, and the join button. */
export function CircleCard({ audience, placement, headingLevel = "h3" }: { audience: "CREATOR" | "BRAND"; placement: CommunityPlacement; headingLevel?: "h2" | "h3" }) {
  const c = CIRCLES[audience];
  const Heading = headingLevel;
  return (
    <article
      id={c.id}
      aria-labelledby={`${c.id}-title`}
      className="group relative flex scroll-mt-24 flex-col overflow-hidden rounded-3xl border bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-[box-shadow,border-color] hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10 sm:p-8"
    >
      <div aria-hidden className={cn("absolute inset-x-0 top-0 h-1 bg-linear-to-r", c.accent)} />
      <div className="flex items-center gap-3">
        <span className={cn("flex size-11 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md shadow-primary/20", c.accent)}>
          <c.icon className="size-5" aria-hidden />
        </span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", c.tint)}>{c.eyebrow}</span>
      </div>
      <Heading id={`${c.id}-title`} className="mt-5 text-2xl font-bold tracking-tight">
        {c.title}
      </Heading>
      <p className="mt-2 text-muted-foreground">{c.description}</p>
      <ul className="mt-6 flex-1 space-y-3" aria-label={`What ${c.title} members get`}>
        {c.benefits.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm font-medium">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success-strong">
              <CheckIcon className="size-3" aria-hidden />
            </span>
            {b}
          </li>
        ))}
      </ul>
      <JoinButton audience={audience} placement={placement} className="mt-8 w-full">
        {c.cta}
      </JoinButton>
      <p className="mt-3 text-center text-xs text-muted-foreground">Free to join · opens WhatsApp</p>
    </article>
  );
}

/**
 * Subtle one-line invitation for pages that already talk to creators or brands:
 * "Join Creator Circle →" with a short supporting sentence.
 */
export function CircleCallout({ audience, placement, className }: { audience: "CREATOR" | "BRAND"; placement: CommunityPlacement; className?: string }) {
  const c = CIRCLES[audience];
  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border bg-card/70 p-4 sm:flex-row sm:items-center sm:gap-4", className)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white", c.accent)}>
        <c.icon className="size-4" aria-hidden />
      </span>
      <p className="flex-1 text-sm text-muted-foreground">{c.callout.body}</p>
      <CommunityJoinLink
        audience={audience}
        placement={placement}
        className="group/callout inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-lg px-1 text-sm font-semibold text-primary hover:text-primary/80 sm:self-auto"
      >
        <WhatsAppIcon className="size-4" />
        {c.callout.label}
        <ArrowRightIcon className="size-4 transition-transform group-hover/callout:translate-x-0.5" aria-hidden />
      </CommunityJoinLink>
    </div>
  );
}

/** The "Join the Refnivo Community on WhatsApp" band. */
export function WhatsAppJoinBand({ placement, className }: { placement: CommunityPlacement; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-5 rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-10", className)}>
      <span className="flex size-14 items-center justify-center rounded-2xl border bg-background shadow-xs">
        <WhatsAppIcon className="size-8" />
      </span>
      <div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Join the Refnivo Community on WhatsApp</h2>
        <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Stay connected with the Refnivo ecosystem and receive important community updates. Be one of the early members of the Refnivo Network.</p>
      </div>
      <JoinButton audience="GENERAL" placement={placement} className="w-full sm:w-auto sm:px-8">
        Join Community
      </JoinButton>
      <p className="max-w-lg text-xs text-muted-foreground">
        As in any WhatsApp group, other members can see your WhatsApp name and number. Please keep it respectful — no spam or unsolicited promotions.
      </p>
    </div>
  );
}

/** Homepage section: "Join the Refnivo Network". */
export function CommunityHomeBand() {
  return (
    <section id="community" aria-labelledby="community-heading" className="scroll-mt-20 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border bg-linear-to-br from-accent via-background to-brand-to/5 p-6 sm:p-10 lg:p-12 dark:via-background">
          <NetworkPattern className="absolute -right-10 -bottom-10 hidden w-[28rem] text-primary sm:block" />
          <div className="relative grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div>
              <NetworkBadge />
              <h2 id="community-heading" className="mt-4 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
                Join the Refnivo Network
              </h2>
              <p className="mt-3 max-w-xl text-lg text-muted-foreground">
                Creators and brands are building the next generation of performance-driven partnerships. Join the community and be part of it.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <JoinButton audience="GENERAL" placement="home-band">
                  Join the Community
                </JoinButton>
                <Button
                  size="lg"
                  variant="outline"
                  nativeButton={false}
                  render={<Link href="/community#creator-circle" />}
                  className="h-12 rounded-xl border-border bg-background px-5 text-base font-semibold shadow-xs hover:bg-muted sm:h-11"
                >
                  Explore Creator Community
                </Button>
              </div>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {(["CREATOR", "BRAND"] as const).map((a) => {
                const c = CIRCLES[a];
                return (
                  <li key={a}>
                    <Link
                      href={`/community#${c.id}`}
                      className="group flex items-center gap-3 rounded-2xl border bg-card/80 p-4 shadow-xs backdrop-blur-sm transition-[box-shadow,border-color] hover:border-primary/25 hover:shadow-md"
                    >
                      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br text-white", c.accent)}>
                        <c.icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{c.title}</span>
                        <span className="block truncate text-sm text-muted-foreground">{c.eyebrow} · {c.benefits[0]}</span>
                      </span>
                      <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
