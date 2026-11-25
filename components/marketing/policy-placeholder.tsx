import { AlertCircleIcon } from "lucide-react";

/**
 * Policy pages keep owner-supplied details (dates, contact e-mail, legal entity)
 * as `[INSERT …]` until they are filled in. Such a value renders with a visible
 * "needs to be filled in" marker, so a placeholder can never pass for a real
 * policy detail.
 */
export const isPlaceholder = (value: string) => /^\[.*\]$/.test(value.trim());

export function Editable({ value }: { value: string }) {
  if (!isPlaceholder(value)) return <>{value}</>;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-dashed border-warning/70 bg-warning/10 px-1.5 py-0.5 font-mono text-[0.8em] text-warning-strong">
      <AlertCircleIcon className="size-3" aria-hidden />
      {value}
    </span>
  );
}
