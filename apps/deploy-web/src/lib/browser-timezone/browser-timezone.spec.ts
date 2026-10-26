import { afterEach, describe, expect, it, vi } from "vitest";

import { detectBrowserTimezone, getBrowserTimezoneOrUtc } from "./browser-timezone";

import { stubResolvedTimezone } from "@tests/unit/stubResolvedTimezone";

describe(detectBrowserTimezone.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the time zone the browser resolves", () => {
    stubResolvedTimezone("America/Vancouver");

    expect(detectBrowserTimezone()).toBe("America/Vancouver");
  });

  it("returns nothing when the browser resolves no time zone", () => {
    stubResolvedTimezone(undefined);

    expect(detectBrowserTimezone()).toBeUndefined();
  });

  it("returns nothing when the browser resolves an empty time zone", () => {
    stubResolvedTimezone("");

    expect(detectBrowserTimezone()).toBeUndefined();
  });
});

describe(getBrowserTimezoneOrUtc.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the time zone the browser resolves", () => {
    stubResolvedTimezone("Europe/Paris");

    expect(getBrowserTimezoneOrUtc()).toBe("Europe/Paris");
  });

  it("falls back to UTC when the browser resolves no time zone", () => {
    stubResolvedTimezone(undefined);

    expect(getBrowserTimezoneOrUtc()).toBe("UTC");
  });
});
