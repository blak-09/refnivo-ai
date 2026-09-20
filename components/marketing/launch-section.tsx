import { RocketIcon } from "lucide-react";
import { LaunchVideo } from "@/components/marketing/launch-video";

/** "🚀 Refnivo AI Product Launch" — sits directly under the brands strip on the home page. */
export function LaunchSection() {
  return (
    <section aria-labelledby="launch-video-heading" className="py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 px-4 py-8 text-white shadow-2xl sm:px-8 sm:py-12 lg:px-12">
          {/* subtle violet glow, matching the hero accent */}
          <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-80 w-[40rem] -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
          <div className="relative mx-auto max-w-3xl text-center">
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-300">
              <RocketIcon className="size-4" aria-hidden />
              Product launch
            </p>
            <h2 id="launch-video-heading" className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              <span aria-hidden>🚀 </span>Refnivo AI Product Launch
            </h2>
            <p className="mt-3 text-slate-300">See how Refnivo AI connects brands, creators and customers through referral marketing.</p>
          </div>
          <LaunchVideo className="relative mx-auto mt-8 max-w-4xl sm:mt-10" />
        </div>
      </div>
    </section>
  );
}
