import { ActivityIcon, AtSignIcon, EyeIcon, HashIcon, PlayCircleIcon, PlayIcon, UsersIcon, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { compact, type CreatorStatsFields } from "@/components/creators/creator-stats";
import { cn } from "@/lib/utils";

/** Four headline audience numbers. Always labelled self-reported. */
export function CreatorStatTiles({ profile }: { profile: CreatorStatsFields }) {
  const tiles: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: UsersIcon, label: "Followers", value: compact(profile.instagramFollowers) },
    { icon: PlayIcon, label: "Subscribers", value: compact(profile.youtubeSubscribers) },
    { icon: EyeIcon, label: "Avg. Views", value: compact(profile.averageViews) },
    { icon: ActivityIcon, label: "Engagement Rate", value: profile.engagementRate == null ? "—" : `${profile.engagementRate}%` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-2xl border border-indigo-100/80 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <t.icon className="size-4" aria-hidden />
            </span>
            <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{t.value}</p>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground">{t.label}</p>
          <p className="text-[11px] text-muted-foreground" title="Entered by the creator. Not verified through a social media API.">
            (Self reported)
          </p>
        </div>
      ))}
    </div>
  );
}

/** Category / audience chips. First chip is highlighted. */
export function CreatorTagChips({ tags }: { tags: (string | null | undefined)[] }) {
  const items = Array.from(new Set(tags.filter((t): t is string => !!t && t.trim().length > 0)));
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((t, i) => (
        <Badge key={t} variant="outline" className={cn("rounded-lg px-2.5 py-1 text-xs font-medium", i === 0 && "border-indigo-200 bg-indigo-50 text-indigo-700")}>
          {t}
        </Badge>
      ))}
    </div>
  );
}

export type SocialLink = { icon: LucideIcon; label: string; url: string };

export function creatorSocialLinks(profile: CreatorStatsFields): SocialLink[] {
  const out: SocialLink[] = [];
  if (profile.instagramUrl) out.push({ icon: AtSignIcon, label: "Instagram", url: profile.instagramUrl });
  if (profile.youtubeUrl) out.push({ icon: PlayIcon, label: "YouTube", url: profile.youtubeUrl });
  if (profile.twitterUrl) out.push({ icon: HashIcon, label: "X (Twitter)", url: profile.twitterUrl });
  return out;
}

/** Social profile chips that open in a new tab. */
export function CreatorSocialLinks({ links }: { links: SocialLink[] }) {
  if (!links.length) return <p className="text-sm text-muted-foreground">No social links added yet.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent"
        >
          <l.icon className="size-4 text-indigo-600" aria-hidden />
          {l.label}
        </a>
      ))}
    </div>
  );
}

/** Content sample URLs are arbitrary links (YouTube/Instagram…), so we show branded tiles rather than remote thumbnails. */
export function parseContentSamples(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string" && /^https?:\/\//.test(v));
}

function sampleHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

export function ContentSamples({ samples, limit = 3 }: { samples: string[]; limit?: number }) {
  if (!samples.length) return <p className="text-sm text-muted-foreground">No content samples added yet.</p>;
  return (
    <div className="grid grid-cols-3 gap-3">
      {samples.slice(0, limit).map((url, i) => {
        const host = sampleHost(url);
        const Icon = host.includes("youtube") ? PlayIcon : PlayCircleIcon;
        return (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "group relative flex aspect-[4/5] flex-col items-center justify-center overflow-hidden rounded-xl text-white shadow-md",
              i % 3 === 0 && "bg-linear-to-br from-violet-600 to-indigo-500",
              i % 3 === 1 && "bg-linear-to-br from-indigo-500 to-blue-500",
              i % 3 === 2 && "bg-linear-to-br from-blue-500 to-sky-400",
            )}
            title={url}
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/40 transition-transform group-hover:scale-110">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="absolute right-2 bottom-2 left-2 truncate text-[10px] font-medium opacity-90">{host}</span>
          </a>
        );
      })}
    </div>
  );
}
