import { differenceInMinutes, format } from "date-fns";

import { pluralize } from "@src/utils/stringUtils";

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const DAYS_PER_WEEK = 7;
const DAYS_BEFORE_DATE = 30;

/** How long ago something happened, in the words an activity feed uses, down to a dated label past a month. */
export function formatRelativeTime(timestamp: string | number | Date, now: Date = new Date()): string {
  const date = new Date(timestamp);
  const minutes = differenceInMinutes(now, date);
  if (minutes < 1) return "Just now";
  if (minutes < MINUTES_PER_HOUR) return `${pluralize(minutes, "minute")} ago`;

  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_PER_DAY) return `${pluralize(hours, "hour")} ago`;

  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days === 1) return "Yesterday";
  if (days < DAYS_PER_WEEK) return `${days} days ago`;
  if (days < DAYS_BEFORE_DATE) return `${pluralize(Math.floor(days / DAYS_PER_WEEK), "week")} ago`;

  return format(date, date.getFullYear() === now.getFullYear() ? "MMM d" : "MMM d, yyyy");
}
