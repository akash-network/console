import { formatDuration, intervalToDuration } from "date-fns";

export function formatReclamationWindow(seconds: number): string {
  return formatDuration(intervalToDuration({ start: 0, end: seconds * 1000 }), { format: ["days", "hours", "minutes", "seconds"] });
}
