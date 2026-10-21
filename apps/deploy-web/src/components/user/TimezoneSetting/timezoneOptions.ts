import type { SearchableSelectOption } from "@src/components/shared/SearchableSelect/SearchableSelect";

export const UTC = "UTC";

export function formatTimezoneName(timeZone: string): string {
  return timeZone.replaceAll("_", " ");
}

/** Every zone the browser lists, led by UTC, which some browsers leave out, and by the current zone when the browser lists it under another name. */
export function listTimezoneOptions(currentTimeZone: string, at: Date): SearchableSelectOption[] {
  const listedTimeZones = Intl.supportedValuesOf("timeZone");
  const leadingTimeZones = listedTimeZones.includes(currentTimeZone) ? [UTC] : [UTC, currentTimeZone];

  return [...new Set([...leadingTimeZones, ...listedTimeZones])].map(timeZone => {
    const name = formatTimezoneName(timeZone);
    const offset = formatUtcOffset(timeZone, at);

    return { value: timeZone, label: name, hint: offset, keywords: offset ? [name, offset] : [name] };
  });
}

/** A zone saved from a device with newer time zone data can be unknown to this browser, which then has no offset to show for it. */
function formatUtcOffset(timeZone: string, at: Date): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" }).formatToParts(at).find(part => part.type === "timeZoneName")!.value;
  } catch {
    return "";
  }
}
