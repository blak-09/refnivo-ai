/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { PlayIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const YOUTUBE_ID = "SgE6DVgfIlw";
const EMBED_URL = `https://www.youtube.com/embed/${YOUTUBE_ID}`;
const POSTER_URL = `https://i.ytimg.com/vi/${YOUTUBE_ID}/hqdefault.jpg`;

/**
 * Product-launch video, rendered as a lightweight "facade": the page ships only
 * a lazily-loaded poster image and a play button. The YouTube iframe (and its
 * ~500 KB of player script) is created only after the visitor presses play, so
 * the landing page's load time is unaffected and nothing auto-plays. Once the
 * player is loaded it autoplays because the visitor already asked for it, and
 * YouTube's normal controls take over from there.
 */
export function LaunchVideo({ className }: { className?: string }) {
  const [playing, setPlaying] = React.useState(false);

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-[0_24px_60px_-20px_rgba(76,29,149,0.55)] ring-1 ring-black/40",
        className,
      )}
    >
      {playing ? (
        <iframe
          src={`${EMBED_URL}?autoplay=1&rel=0&modestbranding=1`}
          title="Refnivo AI product launch video"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full"
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play the Refnivo AI product launch video"
          className="group absolute inset-0 flex size-full items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        >
          <img
            src={POSTER_URL}
            alt=""
            loading="lazy"
            decoding="async"
            className="absolute inset-0 size-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-[1.03]"
          />
          <span aria-hidden className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
          <span
            aria-hidden
            className="relative inline-flex size-16 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-lg ring-1 ring-black/10 transition-transform duration-300 group-hover:scale-105 sm:size-20"
          >
            <PlayIcon className="ml-1 size-7 fill-current sm:size-8" />
          </span>
          <span className="absolute bottom-4 left-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white/90 backdrop-blur sm:bottom-5 sm:left-5">
            Watch the launch · YouTube
          </span>
        </button>
      )}
    </div>
  );
}
