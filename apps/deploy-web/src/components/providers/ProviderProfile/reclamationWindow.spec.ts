import { describe, expect, it } from "vitest";

import { formatReclamationWindow } from "./reclamationWindow";

describe(formatReclamationWindow.name, () => {
  it.each([
    [86400, "1 day"],
    [3 * 86400, "3 days"],
    [31 * 86400, "31 days"],
    [400 * 86400 + 7200, "400 days 2 hours"],
    [86400 + 61, "1 day 1 minute 1 second"],
    [14400, "4 hours"],
    [5400, "1 hour 30 minutes"],
    [45, "45 seconds"]
  ])("reads %i seconds as %s", (seconds, label) => {
    expect(formatReclamationWindow(seconds)).toBe(label);
  });
});
