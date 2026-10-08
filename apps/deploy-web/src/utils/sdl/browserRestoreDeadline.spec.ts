import { describe, expect, it } from "vitest";

import { isBrowserRestoreOffered } from "./browserRestoreDeadline";

describe(isBrowserRestoreOffered.name, () => {
  it("offers the restore before its last day", () => {
    expect(isBrowserRestoreOffered(new Date("2026-10-08T12:00:00Z"))).toBe(true);
  });

  it("offers the restore until the very end of its last day in UTC", () => {
    expect(isBrowserRestoreOffered(new Date("2026-11-09T23:59:59.999Z"))).toBe(true);
  });

  it("stops offering the restore once its last day is over", () => {
    expect(isBrowserRestoreOffered(new Date("2026-11-10T00:00:00Z"))).toBe(false);
  });
});
