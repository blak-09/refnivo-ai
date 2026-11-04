/* eslint-disable @next/next/no-img-element -- uploaded images may live on the storage host; same approach as ImageUpload */
import { BadgeCheckIcon, GlobeIcon, LinkIcon, MapPinIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { COLLABORATION_LABEL, GENDER_OPTIONS } from "@/lib/onboarding/options";
import type { BrandProfileValues, CreatorOnboardingValues, CustomerProfileValues } from "@/lib/validation/onboarding";
import { cn } from "@/lib/utils";

const place = (...parts: (string | undefined)[]) => parts.filter((p) => p && p.trim()).join(", ");
const host = (url: string) => url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");

function Avatar({ src, name, square = false }: { src?: string; name: string; square?: boolean }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return src ? (
    <img src={src} alt="" className={cn("size-20 shrink-0 border-4 border-card bg-muted object-cover shadow-sm", square ? "rounded-2xl" : "rounded-full")} />
  ) : (
    <span className={cn("bg-gradient-brand flex size-20 shrink-0 items-center justify-center border-4 border-card text-xl font-semibold text-white shadow-sm", square ? "rounded-2xl" : "rounded-full")} aria-hidden>
      {initials || "?"}
    </span>
  );
}

function Links({ links }: { links: { label: string; url?: string }[] }) {
  const present = links.filter((l): l is { label: string; url: string } => !!l.url);
  if (!present.length) return <p className="text-sm text-muted-foreground">No social links added.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {present.map((l) => (
        <li key={l.label + l.url}>
          <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
            <LinkIcon className="size-3 text-muted-foreground" aria-hidden />
            <span className="font-medium">{l.label}</span>
            <span className="truncate text-muted-foreground">{host(l.url)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5 border-t py-4 first:border-t-0 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

const Chips = ({ items, labels }: { items: string[]; labels?: Record<string, string> }) =>
  items.length ? (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Badge key={i} variant="secondary">
          {labels?.[i] ?? i}
        </Badge>
      ))}
    </div>
  ) : (
    <span className="text-muted-foreground">—</span>
  );

/** "How your profile will appear" — page 3 of onboarding. */
export function ProfilePreview(
  props:
    | { role: "BRAND_OWNER"; values: BrandProfileValues }
    | { role: "CREATOR"; values: CreatorOnboardingValues }
    | { role: "CUSTOMER"; values: CustomerProfileValues; email: string },
) {
  if (props.role === "BRAND_OWNER") {
    const v = props.values;
    return (
      <article className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-28 bg-linear-to-r from-violet-200 to-sky-200 sm:h-36 dark:from-violet-900/50 dark:to-sky-900/40">
          {v.coverImageUrl ? <img src={v.coverImageUrl} alt="" className="size-full object-cover" /> : null}
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <div className="-mt-10 flex flex-wrap items-end gap-4">
            <Avatar src={v.logoUrl} name={v.name} square />
            <div className="min-w-0 pb-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">{v.name}</h2>
              <p className="text-sm text-muted-foreground">{v.industry}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 whitespace-pre-line">{v.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {v.website ? (
              <span className="inline-flex items-center gap-1.5">
                <GlobeIcon className="size-4" aria-hidden /> {host(v.website)}
              </span>
            ) : null}
            {place(v.city, v.state, v.country) ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="size-4" aria-hidden /> {place(v.city, v.state, v.country)}
              </span>
            ) : null}
          </div>
          <dl className="mt-5 rounded-xl border px-4">
            <Row label="Social links">
              <Links links={[{ label: "Instagram", url: v.instagramUrl }, { label: "Facebook", url: v.facebookUrl }, { label: "LinkedIn", url: v.linkedinUrl }, { label: "YouTube", url: v.youtubeUrl }]} />
            </Row>
            <Row label="Product categories">
              <Chips items={v.productCategories} />
            </Row>
            <Row label="Collaboration types">
              <Chips items={v.collaborationTypes} labels={COLLABORATION_LABEL} />
            </Row>
            {v.targetAudience ? <Row label="Target audience">{v.targetAudience}</Row> : null}
            <Row label="Contact (private)">
              {v.contactName} · {v.businessEmail}
            </Row>
          </dl>
        </div>
      </article>
    );
  }

  if (props.role === "CREATOR") {
    const v = props.values;
    return (
      <article className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar src={v.profileImageUrl} name={v.displayName} />
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold tracking-tight">{v.displayName}</h2>
            <p className="text-sm text-muted-foreground">@{v.username}</p>
            <Badge className="mt-2">{v.category}</Badge>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 whitespace-pre-line">{v.bio}</p>
        {place(v.city, v.state, v.country) ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPinIcon className="size-4" aria-hidden /> {place(v.city, v.state, v.country)}
          </p>
        ) : null}
        <dl className="mt-5 rounded-xl border px-4">
          <Row label="Social profiles">
            <Links
              links={[
                { label: "Instagram", url: v.instagramUrl },
                { label: "YouTube", url: v.youtubeUrl },
                { label: "LinkedIn", url: v.linkedinUrl },
                { label: "Facebook", url: v.facebookUrl },
                ...v.otherLinks.map((url) => ({ label: "Link", url })),
              ]}
            />
          </Row>
          <Row label="Collaboration interests">
            <Chips items={v.collaborationPreferences} labels={COLLABORATION_LABEL} />
          </Row>
          <Row label="Interested in">
            <Chips items={v.interestedCategories} />
          </Row>
          {v.primaryPlatform || v.audienceSize || v.contentLanguage ? (
            <Row label="Audience">
              {[v.primaryPlatform, v.audienceSize ? `${v.audienceSize} followers (self-reported)` : "", v.contentLanguage].filter(Boolean).join(" · ")}
            </Row>
          ) : null}
          {v.contentDescription ? <Row label="Content">{v.contentDescription}</Row> : null}
        </dl>
        <p className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <BadgeCheckIcon className="size-3.5" aria-hidden /> Your public page: refnivo.com/creators/{v.username}
        </p>
      </article>
    );
  }

  const v = props.values;
  const gender = GENDER_OPTIONS.find((g) => g.value === v.gender)?.label;
  return (
    <article className="rounded-2xl border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar src={v.avatarUrl} name={v.name} />
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold tracking-tight">{v.name}</h2>
          <p className="text-sm text-muted-foreground">@{v.username}</p>
        </div>
      </div>
      {v.bio ? <p className="mt-4 text-sm leading-6">{v.bio}</p> : null}
      <dl className="mt-5 rounded-xl border px-4">
        <Row label="Location">{place(v.city, v.state, v.country)}</Row>
        <Row label="Interests">
          <Chips items={v.interests} />
        </Row>
        <Row label="Preferred categories">
          <Chips items={v.preferredCategories} />
        </Row>
        {v.favouriteBrands ? <Row label="Favourite brands">{v.favouriteBrands}</Row> : null}
        {gender ? <Row label="Gender">{gender}</Row> : null}
        <Row label="Email">{props.email}</Row>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">Only you can see your customer profile.</p>
    </article>
  );
}
