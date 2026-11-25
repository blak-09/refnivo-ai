import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Marketing call-to-action. `gradient` is the primary purple→blue CTA from the
 * brand reference; `outline` is the quiet secondary action; `light` is a white
 * button for use on gradient/dark bands.
 */
export function CTAButton({
  href,
  children,
  variant = "gradient",
  size = "lg",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "gradient" | "outline" | "light";
  size?: "default" | "lg";
  className?: string;
}) {
  return (
    <Button
      size={size}
      variant={variant === "outline" ? "outline" : variant === "light" ? "secondary" : "default"}
      nativeButton={false}
      render={<Link href={href} />}
      className={cn(
        "rounded-xl font-semibold",
        variant === "gradient" &&
          "bg-gradient-brand text-white shadow-md shadow-primary/25 transition-[box-shadow,transform] hover:shadow-lg hover:shadow-primary/30 active:translate-y-px",
        variant === "outline" && "border-border bg-background shadow-xs hover:bg-muted",
        variant === "light" && "bg-white text-primary shadow-md hover:bg-accent",
        className,
      )}
    >
      {children}
    </Button>
  );
}
