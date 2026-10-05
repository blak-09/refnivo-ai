"use client";

import * as React from "react";
import { COMMUNITY_ALL_EVENT, COMMUNITY_EVENTS, COMMUNITY_INVITES, type CommunityAudience, type CommunityPlacement } from "@/lib/config/community";

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Records a join click without delaying the navigation:
 *  - first-party count via sendBeacon → /api/community/click (shown on the admin overview);
 *  - `dataLayer` / `gtag` events, picked up automatically if GA or GTM is ever added.
 * Never throws: tracking must not stop anyone from joining.
 */
export function trackCommunityJoin(audience: CommunityAudience, placement: CommunityPlacement) {
  try {
    const payload = JSON.stringify({ audience, placement });
    if (!navigator.sendBeacon?.("/api/community/click", new Blob([payload], { type: "text/plain" }))) {
      void fetch("/api/community/click", { method: "POST", body: payload, keepalive: true }).catch(() => {});
    }
    const events = audience === "GENERAL" ? [COMMUNITY_ALL_EVENT] : [COMMUNITY_EVENTS[audience], COMMUNITY_ALL_EVENT];
    window.dataLayer = window.dataLayer ?? [];
    for (const event of events) {
      window.dataLayer.push({ event, community_audience: audience.toLowerCase(), community_placement: placement });
      window.gtag?.("event", event, { community_audience: audience.toLowerCase(), community_placement: placement });
    }
  } catch {
    // ignore
  }
}

/**
 * The WhatsApp invite as a real link: opens in a new tab on desktop, and on
 * phones the chat.whatsapp.com link hands off to the WhatsApp app.
 * Style it through `className`, or render it as a Button with `render`.
 */
export const CommunityJoinLink = React.forwardRef<
  HTMLAnchorElement,
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "target" | "rel"> & { audience: CommunityAudience; placement: CommunityPlacement }
>(function CommunityJoinLink({ audience, placement, onClick, children, ...props }, ref) {
  return (
    <a
      ref={ref}
      {...props}
      href={COMMUNITY_INVITES[audience]}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        trackCommunityJoin(audience, placement);
        onClick?.(e);
      }}
    >
      {children}
      <span className="sr-only"> (opens WhatsApp in a new tab)</span>
    </a>
  );
});
