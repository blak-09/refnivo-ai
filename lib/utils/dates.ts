import { format, formatDistanceToNowStrict } from "date-fns";

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "d MMM yyyy");
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "d MMM yyyy, h:mm a");
}

export function timeAgo(d: Date | string): string {
  return formatDistanceToNowStrict(new Date(d), { addSuffix: true });
}

export function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  return format(new Date(d), "yyyy-MM-dd");
}
