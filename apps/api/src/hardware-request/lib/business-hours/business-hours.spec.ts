import { describe, expect, it } from "vitest";

import { addBusinessMinutes, type BusinessHours, isTimeZone } from "./business-hours";

const NEW_YORK_OFFICE: BusinessHours = { timeZone: "America/New_York", days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 };

describe(addBusinessMinutes.name, () => {
  it.each([
    { case: "within the same day", start: "2026-11-10T15:00:00.000Z", minutes: 240, due: "2026-11-10T19:00:00.000Z" },
    { case: "up to the closing time exactly", start: "2026-11-10T18:00:00.000Z", minutes: 240, due: "2026-11-10T22:00:00.000Z" },
    { case: "into the next open day", start: "2026-11-10T20:00:00.000Z", minutes: 240, due: "2026-11-11T16:00:00.000Z" },
    { case: "across several days", start: "2026-11-10T15:00:00.000Z", minutes: 960, due: "2026-11-12T15:00:00.000Z" },
    { case: "from before opening", start: "2026-11-10T12:00:00.000Z", minutes: 60, due: "2026-11-10T15:00:00.000Z" },
    { case: "from a Friday evening to the Monday", start: "2026-11-13T23:00:00.000Z", minutes: 240, due: "2026-11-16T18:00:00.000Z" },
    { case: "nothing from a Saturday, to the Monday opening", start: "2026-11-14T17:00:00.000Z", minutes: 0, due: "2026-11-16T14:00:00.000Z" },
    { case: "nothing at closing time, to the next opening", start: "2026-11-10T22:00:00.000Z", minutes: 0, due: "2026-11-11T14:00:00.000Z" },
    { case: "across the end of daylight saving time", start: "2026-10-30T20:00:00.000Z", minutes: 120, due: "2026-11-02T15:00:00.000Z" },
    { case: "across the start of daylight saving time", start: "2026-03-06T21:00:00.000Z", minutes: 120, due: "2026-03-09T14:00:00.000Z" }
  ])("counts New York office minutes $case", ({ start, minutes, due }) => {
    expect(addBusinessMinutes(new Date(start), minutes, NEW_YORK_OFFICE).toISOString()).toBe(due);
  });

  it("reads the opening hours in the configured time zone", () => {
    const berlinOffice = { ...NEW_YORK_OFFICE, timeZone: "Europe/Berlin" };

    expect(addBusinessMinutes(new Date("2026-11-09T08:00:00.000Z"), 60, berlinOffice).toISOString()).toBe("2026-11-09T09:00:00.000Z");
  });

  it("opens only on the configured days, through to midnight", () => {
    const sundaysOnly = { ...NEW_YORK_OFFICE, days: [7], startHour: 0, endHour: 24 };

    expect(addBusinessMinutes(new Date("2026-11-09T17:00:00.000Z"), 60, sundaysOnly).toISOString()).toBe("2026-11-15T06:00:00.000Z");
  });

  it("opens at the wall-clock hour on the day daylight saving time starts", () => {
    const sundayNights = { ...NEW_YORK_OFFICE, days: [7], startHour: 3, endHour: 5 };

    expect(addBusinessMinutes(new Date("2026-03-07T17:00:00.000Z"), 30, sundayNights).toISOString()).toBe("2026-03-08T07:30:00.000Z");
  });

  it("opens at the end of the jump when the opening hour is skipped by daylight saving time", () => {
    const sundayNights = { ...NEW_YORK_OFFICE, days: [7], startHour: 2, endHour: 5 };

    expect(addBusinessMinutes(new Date("2026-03-07T17:00:00.000Z"), 60, sundayNights).toISOString()).toBe("2026-03-08T08:00:00.000Z");
  });

  it("walks past a day whose midnight daylight saving time skips", () => {
    const havanaOffice = { ...NEW_YORK_OFFICE, timeZone: "America/Havana" };

    expect(addBusinessMinutes(new Date("2026-03-06T21:30:00.000Z"), 240, havanaOffice).toISOString()).toBe("2026-03-09T16:30:00.000Z");
  });

  it("refuses a calendar that never opens", () => {
    expect(() => addBusinessMinutes(new Date("2026-11-10T15:00:00.000Z"), 60, { ...NEW_YORK_OFFICE, days: [] })).toThrow(
      "Business hours open on no day within 400 days"
    );
  });
});

describe(isTimeZone.name, () => {
  it.each([
    { timeZone: "America/New_York", valid: true },
    { timeZone: "Mars/Olympus_Mons", valid: false }
  ])("calls $timeZone a time zone: $valid", ({ timeZone, valid }) => {
    expect(isTimeZone(timeZone)).toBe(valid);
  });
});
