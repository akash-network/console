import { describe, expect, it } from "vitest";

import { formatCalendarDay, formatCalendarMonth, formatTimeSince } from "./marketplaceDates";

describe("marketplaceDates", () => {
  describe(formatCalendarDay.name, () => {
    it("writes the day, the short month and the year", () => {
      expect(formatCalendarDay("2026-10-30T12:00:00.000Z")).toBe("Oct 30, 2026");
    });

    it("keeps the UTC day for an instant that is another day in most time zones", () => {
      expect(formatCalendarDay("2026-11-01T00:30:00.000Z")).toBe("Nov 1, 2026");
      expect(formatCalendarDay("2026-10-31T23:30:00.000Z")).toBe("Oct 31, 2026");
    });
  });

  describe(formatCalendarMonth.name, () => {
    it("writes the short month and the year without the day", () => {
      expect(formatCalendarMonth("2025-07-11T12:00:00.000Z")).toBe("Jul 2025");
    });

    it("keeps the UTC month for an instant that is another month in most time zones", () => {
      expect(formatCalendarMonth("2026-01-01T00:30:00.000Z")).toBe("Jan 2026");
      expect(formatCalendarMonth("2025-12-31T23:30:00.000Z")).toBe("Dec 2025");
    });
  });

  describe(formatTimeSince.name, () => {
    it("measures from the moment the data was read", () => {
      const readAt = Date.parse("2026-11-21T12:00:00.000Z");

      expect(formatTimeSince("2026-11-21T10:00:00.000Z", readAt)).toBe("2 hours ago");
      expect(formatTimeSince("2026-11-18T12:00:00.000Z", readAt)).toBe("3 days ago");
    });

    it("says the same thing however long after the read it is asked", () => {
      const readAt = Date.parse("2026-11-21T12:00:00.000Z");

      expect(formatTimeSince("2026-11-21T11:59:53.000Z", readAt)).toBe("7 seconds ago");
      expect(formatTimeSince("2026-11-21T11:59:53.000Z", readAt)).toBe("7 seconds ago");
    });

    it("counts a day as 24 hours and rounds to the nearest whole unit", () => {
      const readAt = Date.parse("2026-11-02T06:00:00.000Z");

      expect(formatTimeSince("2026-10-31T18:00:00.000Z", readAt)).toBe("2 days ago");
      expect(formatTimeSince("2026-11-02T04:31:00.000Z", readAt)).toBe("1 hour ago");
    });

    it("writes each length in the largest unit it fills", () => {
      const readAt = Date.parse("2026-11-21T12:00:00.000Z");

      expect(formatTimeSince("2026-11-21T11:59:00.000Z", readAt)).toBe("1 minute ago");
      expect(formatTimeSince("2026-11-20T12:00:00.000Z", readAt)).toBe("1 day ago");
      expect(formatTimeSince("2026-09-22T12:00:00.000Z", readAt)).toBe("2 months ago");
      expect(formatTimeSince("2024-11-21T12:00:00.000Z", readAt)).toBe("2 years ago");
    });

    it("never points to the future when the reader's clock is behind", () => {
      const readAt = Date.parse("2026-11-21T12:00:00.000Z");

      expect(formatTimeSince("2026-11-21T12:00:05.000Z", readAt)).toBe("0 seconds ago");
    });
  });
});
