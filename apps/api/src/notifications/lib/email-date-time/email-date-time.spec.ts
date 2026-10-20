import { describe, expect, it } from "vitest";

import { formatEmailDateTime } from "./email-date-time";

describe(formatEmailDateTime.name, () => {
  const SUMMER_AFTERNOON = new Date("2026-10-21T15:04:00.000Z");
  const WINTER_AFTERNOON = new Date("2026-01-21T15:04:00.000Z");
  const LONG_DATE_SHORT_TIME: Intl.DateTimeFormatOptions = { dateStyle: "long", timeStyle: "short" };

  it("shows the time in the recipient's timezone and names it", () => {
    expect(formatEmailDateTime(SUMMER_AFTERNOON, "Europe/Paris", LONG_DATE_SHORT_TIME)).toBe("October 21, 2026 at 5:04 PM Central European Summer Time");
  });

  it("names the zone as it stands on that date", () => {
    expect(formatEmailDateTime(WINTER_AFTERNOON, "America/New_York", LONG_DATE_SHORT_TIME)).toBe("January 21, 2026 at 10:04 AM Eastern Standard Time");
  });

  it("keeps the caller's date and time format", () => {
    const format: Intl.DateTimeFormatOptions = { hour12: false, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };

    expect(formatEmailDateTime(SUMMER_AFTERNOON, "Asia/Tokyo", format)).toBe("Oct 22, 2026, 00:04 Japan Standard Time");
  });

  it.each([null, undefined])("shows UTC when the recipient's timezone is %s", timeZone => {
    expect(formatEmailDateTime(SUMMER_AFTERNOON, timeZone, LONG_DATE_SHORT_TIME)).toBe("October 21, 2026 at 3:04 PM UTC");
  });

  it("shows UTC for a timezone the runtime does not know", () => {
    expect(formatEmailDateTime(SUMMER_AFTERNOON, "Mars/Olympus", LONG_DATE_SHORT_TIME)).toBe("October 21, 2026 at 3:04 PM UTC");
  });

  it("calls UTC by its abbreviation when the recipient picked it", () => {
    expect(formatEmailDateTime(SUMMER_AFTERNOON, "UTC", LONG_DATE_SHORT_TIME)).toBe("October 21, 2026 at 3:04 PM UTC");
  });
});
