import Image, { type StaticImageData } from "next/image";
import { ArrowUpRightIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type Founder = {
  name: string;
  role: string;
  /** Imported statically so next/image knows the intrinsic size and can optimise it. */
  photo: StaticImageData;
  alt: string;
  bio: string[];
  linkedin: string;
};

/**
 * Leadership card. The whole card is a hover target and the LinkedIn link is the
 * single focusable action inside it — `after:absolute` stretches that link over
 * the card, so a click anywhere opens the profile while keyboard users get one
 * clearly labelled link rather than a nested-interactive mess.
 */
export function FounderCard({ founder, priority }: { founder: Founder; priority?: boolean }) {
  return (
    <Card className="group relative h-full overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
      <CardContent className="flex h-full flex-col items-center gap-5 py-2 text-center sm:items-start sm:text-left">
        <div className="relative size-36 shrink-0 overflow-hidden rounded-full ring-2 ring-indigo-100 ring-offset-4 ring-offset-card transition-transform duration-300 group-hover:scale-[1.03] sm:size-40">
          <Image
            src={founder.photo}
            alt={founder.alt}
            fill
            sizes="(max-width: 640px) 144px, 160px"
            className="object-cover"
            placeholder="blur"
            priority={priority}
          />
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-tight">{founder.name}</h3>
          <p className="mt-0.5 text-sm font-medium text-indigo-600">{founder.role}</p>
        </div>

        <div className="flex-1 space-y-3">
          {founder.bio.map((paragraph) => (
            <p key={paragraph.slice(0, 32)} className="text-sm leading-6 text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>

        <a
          href={founder.linkedin}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`View ${founder.name}'s LinkedIn profile (opens in a new tab)`}
          className="inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors group-hover:border-primary/40 group-hover:bg-primary/5 focus-visible:outline-none after:absolute after:inset-0 after:content-['']"
        >
          View LinkedIn Profile
          <ArrowUpRightIcon className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
        </a>
      </CardContent>
    </Card>
  );
}
