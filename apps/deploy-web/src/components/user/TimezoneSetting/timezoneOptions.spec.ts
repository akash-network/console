import { describe, expect, it } from "vitest";

import { formatTimezoneName, listTimezoneOptions } from "./timezoneOptions";

describe(listTimezoneOptions.name, () => {
  const JULY = new Date("2026-07-01T12:00:00.000Z");
  const JANUARY = new Date("2026-01-01T12:00:00.000Z");

  it("lists UTC first, then every zone the browser knows in its order", () => {
    const options = listTimezoneOptions("Europe/Paris", JULY);

    expect(options.map(option => option.value)).toEqual(["UTC", ...Intl.supportedValuesOf("timeZone")]);
  });

  it("names each zone readably and hints its offset from UTC at the given time", () => {
    const options = listTimezoneOptions("UTC", JULY);

    expect(options).toContainEqual({ value: "America/New_York", label: "America/New York", hint: "GMT-4", keywords: ["America/New York", "GMT-4"] });
    expect(options[0]).toEqual({ value: "UTC", label: "UTC", hint: "GMT+0", keywords: ["UTC", "GMT+0"] });
  });

  it("follows daylight saving time in the offset", () => {
    const options = listTimezoneOptions("UTC", JANUARY);

    expect(options.find(option => option.value === "America/New_York")?.hint).toBe("GMT-5");
  });

  it("lists the current zone right after UTC when the browser knows it under another name", () => {
    const options = listTimezoneOptions("Asia/Kolkata", JULY);

    expect(options.slice(0, 2).map(option => option.value)).toEqual(["UTC", "Asia/Kolkata"]);
    expect(options.filter(option => option.value === "Asia/Kolkata")).toHaveLength(1);
  });
});

describe(formatTimezoneName.name, () => {
  it("spells underscores as spaces", () => {
    expect(formatTimezoneName("America/Argentina/Buenos_Aires")).toBe("America/Argentina/Buenos Aires");
  });
});
