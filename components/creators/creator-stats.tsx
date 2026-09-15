import { AtSignIcon, ExternalLinkIcon, HashIcon, PlayIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type CreatorStatsFields = {
  instagramHandle: string | null;
  instagramUrl: string | null;
  instagramFollowers: number | null;
  youtubeChannel: string | null;
  youtubeUrl: string | null;
  youtubeSubscribers: number | null;
  twitterHandle: string | null;
  twitterUrl: string | null;
  averageViews: number | null;
  engagementRate: number | null;
  audienceCategory: string | null;
  audienceLocation: string | null;
  category: string | null;
  location: string | null;
  previousCampaigns: string | null;
  contentSamples: unknown;
};

export function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function SelfReported({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("border-dashed text-[10px] text-muted-foreground", className)} title="Entered by the creator. Not verified through a social media API.">
      Self-reported
    </Badge>
  );
}

/** Social handles + audience numbers. Shown to brands and on public creator profiles — never to customers. */
export function CreatorSocialStats({ profile, compactView = false }: { profile: CreatorStatsFields; compactView?: boolean }) {
  const socials = [
    { icon: AtSignIcon, label: "Instagram", handle: profile.instagramHandle, url: profile.instagramUrl, count: profile.instagramFollowers, unit: "followers" },
    { icon: PlayIcon, label: "YouTube", handle: profile.youtubeChannel, url: profile.youtubeUrl, count: profile.youtubeSubscribers, unit: "subscribers" },
    { icon: HashIcon, label: "X / Twitter", handle: profile.twitterHandle, url: profile.twitterUrl, count: null, unit: "" },
  ].filter((s) => s.handle || s.url || s.count);

  const hasNumbers = profile.instagramFollowers || profile.youtubeSubscribers || profile.averageViews || profile.engagementRate;

  return (
    <div className="space-y-2">
      {socials.length ? (
        <ul className={cn("flex flex-wrap gap-x-4 gap-y-1", compactView ? "text-xs" : "text-sm")}>
          {socials.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5">
              <s.icon className="size-3.5 text-muted-foreground" aria-hidden />
              {s.url ? (
                <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {s.handle ? `@${s.handle}` : s.label}
                </a>
              ) : (
                <span>{s.handle ? `@${s.handle}` : s.label}</span>
              )}
              {s.count ? (
                <span className="text-muted-foreground">
                  · {compact(s.count)} {s.unit}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No social media links added.</p>
      )}
      {hasNumbers ? (
        <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground", compactView ? "text-xs" : "text-sm")}>
          {profile.averageViews ? <span>Avg. views {compact(profile.averageViews)}</span> : null}
          {profile.engagementRate ? <span>Engagement {profile.engagementRate}%</span> : null}
          <SelfReported />
        </div>
      ) : null}
    </div>
  );
}

export function CreatorAudience({ profile }: { profile: CreatorStatsFields }) {
  const rows = [
    { label: "Creator category", value: profile.category },
    { label: "Location", value: profile.location },
    { label: "Audience", value: profile.audienceCategory },
    { label: "Audience location", value: profile.audienceLocation },
  ].filter((r) => r.value);
  const samples = Array.isArray(profile.contentSamples) ? (profile.contentSamples as string[]) : [];
  return (
    <div className="space-y-3 text-sm">
      {rows.length ? (
        <dl className="grid gap-2 sm:grid-cols-2">
          {rows.map((r) => (
            <div key={r.label}>
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd>{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {profile.previousCampaigns ? (
        <div>
          <p className="text-xs text-muted-foreground">Previous campaigns</p>
          <p className="whitespace-pre-line">{profile.previousCampaigns}</p>
        </div>
      ) : null}
      {samples.length ? (
        <div>
          <p className="text-xs text-muted-foreground">Content samples</p>
          <ul className="mt-1 space-y-1">
            {samples.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-primary hover:underline">
                  {u.replace(/^https?:\/\//, "").slice(0, 60)} <ExternalLinkIcon className="size-3" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

