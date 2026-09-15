import { CheckCircle2Icon, type LucideIcon } from "lucide-react";
import { CTAButton } from "@/components/marketing/cta-button";
import { cn } from "@/lib/utils";

/** Two-column benefits block: copy + bullet chips on one side, a visual on the other. */
export function BenefitSection({
  id,
  eyebrow,
  title,
  description,
  items,
  cta,
  icon: Icon,
  visual,
  reverse = false,
  tinted = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
  cta: { href: string; label: string };
  icon: LucideIcon;
  visual: React.ReactNode;
  reverse?: boolean;
  tinted?: boolean;
}) {
  return (
    <section id={id} className={cn("scroll-mt-20 py-16 sm:py-20", tinted && "bg-linear-to-b from-violet-50/60 to-background")}>
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16">
        <div className={cn("space-y-5", reverse && "lg:order-2")}>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
            <Icon className="size-4" aria-hidden />
            {eyebrow}
          </p>
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <li key={item} className="flex items-start gap-2 rounded-lg border bg-card px-3 py-2 text-sm shadow-xs">
                <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-indigo-600" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <CTAButton href={cta.href} size="default">
            {cta.label}
          </CTAButton>
        </div>
        <div className={cn(reverse && "lg:order-1")}>{visual}</div>
      </div>
    </section>
  );
}
