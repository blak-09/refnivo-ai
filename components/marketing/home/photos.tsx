import Image from "next/image";
import { BadgeCheckIcon, CheckIcon, ClockIcon, LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Lifestyle photography for the marketing site.
 *
 * Source: Pexels (pexels.com), Pexels licence — free for commercial use, no
 * attribution required; it must not imply that the people shown endorse
 * Refnivo. The people are models, not Refnivo users: never caption a photo with
 * a name, a result or a testimonial. Credits are listed on /about.
 */
export const PHOTOS = {
  creatorPodcast: { src: "/images/marketing/creator-podcast-desk.webp", w: 900, h: 1600, alt: "A smiling creator at a white studio desk with a tablet and a microphone" },
  creatorRingLight: { src: "/images/marketing/creator-ring-light-setup.webp", w: 1067, h: 1600, alt: "A creator setting up a ring light in her living room" },
  customersSofa: { src: "/images/marketing/customers-sofa-phones.webp", w: 1600, h: 1067, alt: "A couple on a sofa, smiling at something on their phones" },
  creatorVideoRig: { src: "/images/marketing/creator-video-rig.webp", w: 1067, h: 1600, alt: "A video creator framing a shot on his phone beside a camera on a tripod" },
  boutique: { src: "/images/marketing/boutique-saree.webp", w: 1600, h: 1067, alt: "A woman trying a saree drape in a clothing boutique" },
  ugcTryOn: { src: "/images/marketing/ugc-try-on.webp", w: 1067, h: 1600, alt: "A creator holding up a top for the camera, lit by a ring light" },
  friendsStreet: { src: "/images/marketing/friends-street-phone.webp", w: 1600, h: 1067, alt: "Two friends looking at a phone together on a busy street" },
  creatorFilming: { src: "/images/marketing/creator-phone-filming.webp", w: 1600, h: 1067, alt: "A creator filming with her phone on a stand, a laptop beside her" },
  creatorLaptop: { src: "/images/marketing/creator-laptop.webp", w: 1067, h: 1600, alt: "A smiling creator working on her laptop" },
  creatorTutorial: { src: "/images/marketing/creator-tutorial.webp", w: 1067, h: 1600, alt: "A creator recording a tutorial with her phone and a ring light" },
  partnersLaptop: { src: "/images/marketing/partners-review.webp", w: 769, h: 922, alt: "Two colleagues reviewing work on a laptop in an office" },
  brandOwner: { src: "/images/marketing/founder-desk.webp", w: 782, h: 938, alt: "A smiling founder working on a laptop at her desk" },
  festiveFriends: { src: "/images/marketing/festive-friends-phone.webp", w: 1067, h: 1600, alt: "Two women in festive clothes looking at a phone together" },
} as const;

export type Photo = (typeof PHOTOS)[keyof typeof PHOTOS];

/** A rounded photo that fills its box (object-cover), with optional overlay content. */
export function PhotoFrame({
  photo,
  className,
  sizes,
  priority = false,
  children,
  position = "center",
}: {
  photo: Photo;
  className?: string;
  sizes: string;
  priority?: boolean;
  children?: React.ReactNode;
  position?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-[1.75rem] bg-muted", className)}>
      <Image src={photo.src} alt={photo.alt} fill sizes={sizes} priority={priority} className="object-cover" style={{ objectPosition: position }} />
      {children}
    </div>
  );
}

/* ── Hero showcase: a slow, full-bleed strip of tall photo tiles with Refnivo cards between them ── */

type Tile =
  | { kind: "photo"; photo: Photo; tag: string; wide?: boolean; position?: string }
  | { kind: "link" | "order" | "earnings" | "campaign" };

const TILES: Tile[] = [
  { kind: "photo", photo: PHOTOS.creatorPodcast, tag: "Creators", position: "50% 30%" },
  { kind: "link" },
  { kind: "photo", photo: PHOTOS.customersSofa, tag: "Customers share", wide: true, position: "55% 40%" },
  { kind: "photo", photo: PHOTOS.creatorVideoRig, tag: "Video creators", position: "45% 40%" },
  { kind: "order" },
  { kind: "photo", photo: PHOTOS.friendsStreet, tag: "Friends & family", wide: true, position: "35% 50%" },
  { kind: "photo", photo: PHOTOS.creatorRingLight, tag: "UGC creators", position: "55% 40%" },
  { kind: "earnings" },
  { kind: "photo", photo: PHOTOS.boutique, tag: "Product brands", wide: true, position: "50% 35%" },
  { kind: "photo", photo: PHOTOS.creatorTutorial, tag: "Reviews & tutorials", position: "45% 40%" },
  { kind: "campaign" },
  { kind: "photo", photo: PHOTOS.ugcTryOn, tag: "Reels & shorts", wide: true, position: "50% 22%" },
];

function CardShell({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={cn("flex size-full flex-col justify-between rounded-[1.75rem] p-5", dark ? "bg-ink text-ink-foreground" : "bg-gradient-brand text-white")}>
      {children}
    </div>
  );
}

function ShowcaseCard({ kind, qrDataUrl }: { kind: Exclude<Tile["kind"], "photo">; qrDataUrl: string | null }) {
  const label = (text: string) => <p className="text-[11px] font-semibold tracking-[0.12em] text-white/70 uppercase">{text} · Example</p>;
  if (kind === "link") {
    return (
      <CardShell>
        {label("Creator link")}
        <div>
          {qrDataUrl ? (
            <Image src={qrDataUrl} alt="" width={112} height={112} unoptimized className="size-28 rounded-2xl bg-white p-1.5" />
          ) : (
            <span className="block size-28 rounded-2xl bg-white/20" aria-hidden />
          )}
          <p className="mt-4 flex items-center gap-1.5 font-mono text-[13px] font-medium">
            <LinkIcon className="size-3.5 shrink-0" aria-hidden /> <span className="truncate">refnivo.com/r/PRIYA10</span>
          </p>
          <p className="mt-1 text-sm text-white/75">142 clicks · 18 orders</p>
        </div>
      </CardShell>
    );
  }
  if (kind === "order") {
    return (
      <CardShell dark>
        {label("Order")}
        <div>
          <p className="text-5xl font-bold tracking-tight tabular-nums">₹2,499</p>
          <p className="mt-2 text-sm text-white/70">Order #48213 via a creator link</p>
          <p className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
            <BadgeCheckIcon className="size-3.5" aria-hidden /> Verified by the brand
          </p>
          <p className="mt-3 text-sm text-white/80">
            Commission recorded: <span className="font-semibold text-white tabular-nums">₹249.90</span>
          </p>
        </div>
      </CardShell>
    );
  }
  if (kind === "earnings") {
    return (
      <CardShell>
        {label("Earnings")}
        <ul className="space-y-2.5">
          {[
            { icon: ClockIcon, k: "Pending", v: "₹4,180" },
            { icon: CheckIcon, k: "Approved", v: "₹12,640" },
            { icon: BadgeCheckIcon, k: "Paid", v: "₹38,900" },
          ].map((r) => (
            <li key={r.k} className="flex items-center justify-between rounded-2xl bg-white/12 px-3.5 py-2.5 backdrop-blur">
              <span className="flex items-center gap-2 text-sm text-white/85">
                <r.icon className="size-4" aria-hidden /> {r.k}
              </span>
              <span className="font-semibold tabular-nums">{r.v}</span>
            </li>
          ))}
        </ul>
      </CardShell>
    );
  }
  return (
    <CardShell dark>
      {label("Campaign")}
      <div>
        <p className="text-xl font-semibold tracking-tight">Skincare starter kit</p>
        <dl className="mt-4 space-y-2 text-sm">
          {[
            ["Creator commission", "12%"],
            ["Customer reward", "₹100"],
            ["Attribution window", "30 days"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-white/10 pb-2">
              <dt className="text-white/65">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </CardShell>
  );
}

/** Levanta-style hero strip. Drifts slowly, pauses on hover/focus, much slower with reduced motion. */
export function HeroShowcase({ qrDataUrl }: { qrDataUrl: string | null }) {
  const tile = (t: Tile, key: string, hidden: boolean) => (
    <li
      key={key}
      aria-hidden={hidden || undefined}
      className={cn("relative h-[21rem] shrink-0 sm:h-[26rem]", t.kind === "photo" ? (t.wide ? "w-[19rem] sm:w-[25rem]" : "w-56 sm:w-64") : "w-60 sm:w-64")}
    >
      {t.kind === "photo" ? (
        <PhotoFrame photo={t.photo} className="size-full" sizes="(min-width: 640px) 400px, 304px" priority={!hidden && key === "a-0"} position={t.position}>
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-black/45 to-transparent" />
          <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-ink shadow-sm">{t.tag}</span>
        </PhotoFrame>
      ) : (
        <ShowcaseCard kind={t.kind} qrDataUrl={qrDataUrl} />
      )}
    </li>
  );
  return (
    <section aria-label="Creators, customers and example Refnivo cards" className="group/marquee overflow-hidden py-2">
      <ul className="animate-marquee flex w-max gap-4 px-2 [animation-duration:110s] group-focus-within/marquee:[animation-play-state:paused] group-hover/marquee:[animation-play-state:paused] motion-reduce:[animation-duration:400s]">
        {TILES.map((t, i) => tile(t, `a-${i}`, false))}
        {TILES.map((t, i) => tile(t, `b-${i}`, true))}
      </ul>
      <p className="sr-only">Stock photos of models alongside illustrative Refnivo cards; every number shown is an example.</p>
    </section>
  );
}
