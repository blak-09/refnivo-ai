import { Logo } from "@/components/brand/logo";

/**
 * Decorative brand panel shown beside auth/status forms on large screens
 * (hidden on mobile). Keeps the sign-in / sign-up experience on-brand.
 */
export function BrandPanel() {
  return (
    <aside
      aria-hidden
      className="relative hidden overflow-hidden border-l bg-linear-to-br from-accent via-white to-brand-to/5 lg:flex lg:w-[42%] lg:items-center lg:justify-center dark:via-background"
    >
      <div className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 size-72 rounded-full bg-brand-to/20 blur-3xl" />
      <div className="relative flex flex-col items-center gap-4 px-10 text-center">
        <Logo size="lg" href={null} />
        <p className="text-lg font-medium text-muted-foreground">Turn Every Link Into Growth.</p>
      </div>
    </aside>
  );
}
