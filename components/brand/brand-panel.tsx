import { Logo } from "@/components/brand/logo";

/**
 * Decorative brand panel shown beside auth/status forms on large screens
 * (hidden on mobile). Keeps the sign-in / sign-up experience on-brand.
 */
export function BrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden border-l bg-linear-to-br from-violet-50 via-white to-blue-50 lg:flex lg:w-[42%] lg:items-center lg:justify-center dark:from-violet-950/40 dark:via-background dark:to-blue-950/40"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-violet-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-blue-400/20 blur-3xl" />
      <div className="relative flex flex-col items-center gap-4 px-10 text-center">
        <Logo size="lg" href={null} />
        <p className="text-lg font-medium text-muted-foreground">Turn Every Link Into Growth.</p>
      </div>
    </aside>
  );
}
