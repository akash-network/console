/** Intl also accepts UTC offsets such as `+05:00`, which name no zone. */
const UTC_OFFSET = /^[+-]/;

export function isIanaTimeZone(timeZone: string): boolean {
  if (UTC_OFFSET.test(timeZone)) return false;

  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}
