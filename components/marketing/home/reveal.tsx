"use client";

import * as React from "react";

/**
 * Fade-up on scroll. Content is always rendered visible on the server; only an
 * element that starts below the fold is hidden after hydration and revealed
 * when it scrolls in. Reduced-motion users never see the effect (globals.css).
 */
export function Reveal({ children, className, as: Tag = "div", delay = 0 }: { children: React.ReactNode; className?: string; as?: "div" | "li" | "section"; delay?: number }) {
  const ref = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen: never hide it
    el.dataset.reveal = "pending";
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        el.style.transitionDelay = `${delay}ms`;
        el.dataset.reveal = "shown";
        io.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return React.createElement(Tag, { ref, className }, children);
}

/**
 * Counts up to `value` the first time it scrolls into view. Renders the final
 * number on the server (no layout shift, readable without JavaScript) and stays
 * static for reduced-motion users.
 */
export function CountUp({ value, prefix = "", suffix = "", decimals = 0, durationMs = 1100 }: { value: number; prefix?: string; suffix?: string; decimals?: number; durationMs?: number }) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const format = React.useCallback((n: number) => `${prefix}${n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`, [prefix, suffix, decimals]);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    el.textContent = format(0);
    let frame = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = format(value * eased);
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs, format]);
  return (
    <span ref={ref} className="tabular-nums">
      {format(value)}
    </span>
  );
}
