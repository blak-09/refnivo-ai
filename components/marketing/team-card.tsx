import { ExternalLinkIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BrandLogo } from "@/components/products/product-thumb";
import type { TeamMember } from "@/lib/content/team";

/**
 * One person on /team. Photo is optional — without one the card falls back to
 * an initials avatar, so a member can be added with name + role alone.
 */
export function TeamCard({ member }: { member: TeamMember }) {
  return (
    <Card className="h-full rounded-2xl transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-center gap-4">
          <BrandLogo src={member.photoUrl ?? null} name={member.name} className="size-14 rounded-2xl text-base" sizes="56px" />
          <div className="min-w-0">
            <h3 className="font-semibold">{member.name}</h3>
            <p className="text-sm text-indigo-600">{member.role}</p>
          </div>
        </div>
        {member.bio ? <p className="flex-1 text-sm leading-6 text-muted-foreground">{member.bio}</p> : null}
        {member.links?.length ? (
          <ul className="flex flex-wrap gap-2">
            {member.links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                >
                  {link.label}
                  <ExternalLinkIcon className="size-3" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
