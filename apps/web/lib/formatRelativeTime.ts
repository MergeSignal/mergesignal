/**
 * Relative time for dashboard metadata (e.g. PR card footers).
 */
export function formatRelativeTime(iso: string, now = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 2) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const METADATA_TIME_LOCALE = "en-US";

export function formatAbsoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(METADATA_TIME_LOCALE, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
