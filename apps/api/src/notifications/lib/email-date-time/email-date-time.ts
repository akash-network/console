import { isSupportedTimeZone } from "@src/utils/date/date";

const UTC = "UTC";

/** Shows the time in the recipient's timezone, or in UTC when it is unknown, and always names the zone it is in. */
export function formatEmailDateTime(date: Date, timeZone: string | null | undefined, options: Intl.DateTimeFormatOptions): string {
  const zone = timeZone && isSupportedTimeZone(timeZone) ? timeZone : UTC;
  const dateTime = new Intl.DateTimeFormat("en-US", { ...options, timeZone: zone }).format(date);

  return `${dateTime} ${nameTimeZone(date, zone)}`;
}

/** Spells a zone out in full, as in "Central European Summer Time", except UTC, which emails have always called UTC. */
function nameTimeZone(date: Date, timeZone: string): string {
  if (timeZone === UTC) return UTC;

  return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "long" }).formatToParts(date).find(part => part.type === "timeZoneName")!.value;
}
