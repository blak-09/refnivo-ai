"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2Icon, PlusIcon, Trash2Icon } from "lucide-react";
import { addAffiliateCodeAction, removeAffiliateLinkAction } from "@/app/actions/affiliate";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

const PLATFORMS = [
  ["INSTAGRAM", "Instagram"],
  ["YOUTUBE", "YouTube"],
  ["FACEBOOK", "Facebook"],
  ["LINKEDIN", "LinkedIn"],
  ["X", "X"],
] as const;

/** Add a per-platform tracking link, or stop using this programme. */
export function AffiliateLinkControls({ linkId, existing }: { linkId: string; existing: string[] }) {
  const router = useRouter();
  const available = PLATFORMS.filter(([value]) => !existing.includes(value));
  const [source, setSource] = React.useState<string>(available[0]?.[0] ?? "");
  const [pending, setPending] = React.useState<"add" | "remove" | null>(null);

  async function add() {
    if (!source) return;
    setPending("add");
    try {
      const res = await addAffiliateCodeAction({ linkId, source });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Link ready: ${res.data.code}`);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!window.confirm("Stop using this programme on Refnivo? Your Refnivo links stop forwarding; your click history is kept.")) return;
    setPending("remove");
    try {
      const res = await removeAffiliateLinkAction({ linkId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Links disabled.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {available.length ? (
        <div className="flex gap-2">
          <NativeSelect value={source} onChange={(e) => setSource(e.target.value)} aria-label="Platform" className="sm:w-40">
            {available.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" onClick={add} disabled={pending !== null}>
            {pending === "add" ? <Loader2Icon className="animate-spin" aria-hidden /> : <PlusIcon className="size-4" aria-hidden />} Platform link
          </Button>
        </div>
      ) : null}
      <Button size="sm" variant="ghost" onClick={remove} disabled={pending !== null} className="sm:ml-auto">
        <Trash2Icon className="size-4" aria-hidden /> Stop using
      </Button>
    </div>
  );
}
