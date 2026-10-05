import Link from "next/link";
import type { Metadata } from "next";
import { CircleCard, NetworkBadge, NetworkPattern, WhatsAppJoinBand } from "@/components/community/community-ui";

export const metadata: Metadata = {
  title: { absolute: "Refnivo Network — Creator & Brand Community" },
  description: "Join the Refnivo Network to connect with creators and brands, discover partnership opportunities, collaborate and grow together.",
  alternates: { canonical: "/community" },
  openGraph: {
    title: "Refnivo Network — Creator & Brand Community",
    description: "Join the Refnivo Network to connect with creators and brands, discover partnership opportunities, collaborate and grow together.",
    url: "/community",
  },
};

const STEPS = [
  { title: "Choose your circle", body: "Creator Circle or Brand Circle — whichever fits you." },
  { title: "Tap Join", body: "WhatsApp opens with the Refnivo community invite." },
  { title: "Say hello", body: "Join the group and start connecting with the network." },
];

export default function CommunityPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-linear-to-b from-violet-50/70 via-background to-background dark:from-violet-950/20">
        <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[28rem] w-[60rem] max-w-[200vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(124,58,237,0.12),transparent)]" />
        <NetworkPattern className="absolute top-6 right-0 hidden w-[30rem] text-indigo-500 lg:block" />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-foreground">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-foreground" aria-current="page">
                Community
              </li>
            </ol>
          </nav>
          <div className="mt-6 max-w-2xl">
            <NetworkBadge />
            <h1 className="mt-5 text-4xl leading-[1.1] font-bold tracking-tight text-balance sm:text-5xl">
              Welcome to the{" "}
              <span className="bg-linear-to-r from-violet-600 to-blue-500 bg-clip-text text-transparent">Refnivo Network</span>
            </h1>
            <p className="mt-5 text-lg font-medium text-foreground/90 sm:text-xl">
              Where creators and brands connect, collaborate, discover opportunities and grow together.
            </p>
            <p className="mt-3 text-muted-foreground">
              Join the growing Refnivo community to discover creator opportunities, brand partnerships, campaign updates, industry insights and networking
              opportunities.
            </p>
          </div>
        </div>
      </section>

      {/* Circles */}
      <section aria-labelledby="circles-heading" className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">Two circles, one network</p>
            <h2 id="circles-heading" className="mt-1 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Build connections. Discover opportunities. Grow together.
            </h2>
            <p className="mt-3 text-muted-foreground">Pick the circle that fits you. Both are free to join, and you can be part of both.</p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-6 md:grid-cols-2">
            <CircleCard audience="CREATOR" placement="community-page" />
            <CircleCard audience="BRAND" placement="community-page" />
          </div>

          {/* How joining works */}
          <ol className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-3" aria-label="How joining works">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-3 rounded-2xl border bg-muted/30 p-4">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white tabular-nums">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{s.title}</span>
                  <span className="block text-sm text-muted-foreground">{s.body}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* WhatsApp join */}
      <section aria-label="Join on WhatsApp" className="pb-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <WhatsAppJoinBand placement="community-page-band" />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to Refnivo?{" "}
            <Link href="/how-it-works" className="font-medium text-primary underline-offset-4 hover:underline">
              See how the platform works
            </Link>{" "}
            or{" "}
            <Link href="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
              create a free account
            </Link>
            .
          </p>
        </div>
      </section>
    </>
  );
}
