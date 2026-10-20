import { describe, expect, it } from "vitest";

import { isIanaTimeZone } from "./time-zone";

describe(isIanaTimeZone.name, () => {
  it.each(["Europe/Paris", "UTC", "Etc/GMT+5", "Asia/Kolkata"])("accepts %s", timeZone => {
    expect(isIanaTimeZone(timeZone)).toBe(true);
  });

  it.each(["+05:00", "-0300", "Mars/Olympus", ""])("refuses %j, which names no zone", timeZone => {
    expect(isIanaTimeZone(timeZone)).toBe(false);
  });
});
