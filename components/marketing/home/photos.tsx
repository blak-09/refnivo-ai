import Image from "next/image";
import Link from "next/link";
import { ArrowUpRightIcon, BadgeCheckIcon, CheckIcon, ClockIcon, LinkIcon } from "lucide-react";
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
  creatorRingLight: { src: "/images/marketing/creator-ring-light.webp", w: 1600, h: 1065, alt: "A beauty creator holding make-up brushes, framed by a ring light" },
  customerPhone: { src: "/images/marketing/customer-phone.webp", w: 1600, h: 1066, alt: "A young woman smiling at a table, holding her smartphone" },
  brandOwner: { src: "/images/marketing/brand-owner.webp", w: 1600, h: 1066, alt: "A smiling online store owner at her desk, with packed orders and a clothing rack" },
  creatorStudio: { src: "/images/marketing/studio-creator-laptop.webp", w: 1600, h: 1064, alt: "A creator at a laptop in a studio with a camera and a softbox light" },
  customerSofa: { src: "/images/marketing/customer-sofa.webp", w: 1600, h: 1066, alt: "A young woman on a sofa, smiling at her phone" },
  familySelfie: { src: "/images/marketing/family-selfie.webp", w: 1600, h: 1066, alt: "A family in festive clothes taking a selfie together" },
  creatorVlog: { src: "/images/marketing/creator-vlog.webp", w: 1600, h: 1066, alt: "A creator filming herself with a camera in front of a flower wall" },
  podcastStudio: { src: "/images/marketing/podcast-studio.webp", w: 1600, h: 900, alt: "A creator recording at a microphone in a modern studio" },
  creatorGimbal: { src: "/images/marketing/creator-gimbal.webp", w: 1600, h: 1066, alt: "A young videographer filming outdoors with a camera on a gimbal" },
  creatorDesk: { src: "/images/marketing/creator-desk.webp", w: 1600, h: 1066, alt: "A creator at a desk lit in blue, with cameras and a microphone" },
  friendsPhoto: { src: "/images/marketing/friends-photo.webp", w: 1600, h: 1066, alt: "A woman photographing her friend in traditional clothes with a smartphone" },
  creatorPhoneRig: { src: "/images/marketing/creator-phone-rig.webp", w: 1067, h: 1600, alt: "A creator setting up her phone on a tripod next to a ring light" },
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
  { kind: "photo", photo: PHOTOS.creatorRingLight, tag: "Creators", position: "50% 40%" },
  { kind: "link" },
  { kind: "photo", photo: PHOTOS.customerPhone, tag: "Customers share", wide: true, position: "55% 35%" },
  { kind: "photo", photo: PHOTOS.creatorVlog, tag: "Creators", position: "70% 40%" },
  { kind: "order" },
  { kind: "photo", photo: PHOTOS.familySelfie, tag: "Friends & family", wide: true },
  { kind: "photo", photo: PHOTOS.creatorGimbal, tag: "Video creators", position: "62% 40%" },
  { kind: "earnings" },
  { kind: "photo", photo: PHOTOS.friendsPhoto, tag: "Share anywhere", wide: true },
  { kind: "photo", photo: PHOTOS.creatorPhoneRig, tag: "Links & QR codes" },
  { kind: "campaign" },
  { kind: "photo", photo: PHOTOS.creatorDesk, tag: "Track every click", wide: true },
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

/* ── Audience cards: big photo tiles with the role and what it gets ── */

const AUDIENCES = [
  {
    photo: PHOTOS.brandOwner,
    eyebrow: "For brands",
    title: "Grow with partners who sell",
    points: ["A campaign per product", "Approve every creator", "Pay only on verified orders"],
    href: "#brands",
    position: "50% 35%",
  },
  {
    photo: PHOTOS.creatorRingLight,
    eyebrow: "For creators",
    title: "Promote brands you believe in",
    points: ["Commission shown up front", "Your own link and QR code", "Track every rupee earned"],
    href: "#creators",
    position: "50% 40%",
  },
  {
    photo: PHOTOS.customerSofa,
    eyebrow: "For customers",
    title: "Share products you love",
    points: ["No followers needed", "Earn a reward per verified order", "Share on WhatsApp or anywhere"],
    href: "#creators",
    position: "60% 40%",
  },
] as const;

export function AudienceCards() {
  return (
    <ul className="grid gap-5 md:grid-cols-3">
      {AUDIENCES.map((a) => (
        <li key={a.eyebrow}>
          <Link
            href={a.href}
            className="group relative block overflow-hidden rounded-[1.75rem] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <PhotoFrame photo={a.photo} className="aspect-[4/5] rounded-none transition-transform duration-500 group-hover:scale-[1.03]" sizes="(min-width: 768px) 380px, 100vw" position={a.position} />
            <div aria-hidden className="absolute inset-0 bg-linear-to-t from-ink via-ink/55 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-white">
              <p className="text-xs font-semibold tracking-[0.14em] text-violet-200 uppercase">{a.eyebrow}</p>
              <p className="mt-2 flex items-start justify-between gap-3 text-2xl font-semibold tracking-tight">
                {a.title}
                <ArrowUpRightIcon className="mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-white/85">
                {a.points.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <CheckIcon className="size-4 text-violet-200" aria-hidden />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
