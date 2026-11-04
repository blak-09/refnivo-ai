import Link from "next/link";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Completion } from "@/lib/onboarding/completion";

/** "Profile 75% complete" with the next few suggestions. Hidden at 100% unless `always`. */
export function ProfileCompletionCard({ completion, editHref, always = false }: { completion: Completion | null; editHref?: string; always?: boolean }) {
  if (!completion || (completion.percent >= 100 && !always)) return null;
  const done = completion.percent >= 100;
  const tips = completion.suggestions.slice(0, 3);
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <SparklesIcon className="size-4 text-primary" aria-hidden />
              {done ? "Your profile is complete" : `Profile ${completion.percent}% complete`}
            </p>
            <span className="text-sm font-semibold tabular-nums sm:hidden">{completion.percent}%</span>
          </div>
          <Progress value={completion.percent} aria-label="Profile completion" />
          {tips.length ? (
            <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
              {tips.map((t) => (
                <li key={t} className="flex items-start gap-1.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">A complete profile helps brands, creators and customers trust you.</p>
          )}
        </div>
        {editHref ? (
          <Button variant={done ? "outline" : "default"} className="shrink-0" nativeButton={false} render={<Link href={editHref} />}>
            {done ? "Edit profile" : "Complete profile"} <ArrowRightIcon aria-hidden />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
