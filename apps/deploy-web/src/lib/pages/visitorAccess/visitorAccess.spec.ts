import { describe, expect, it } from "vitest";

import { readVisitorAccess } from "./visitorAccess";

describe(readVisitorAccess.name, () => {
  it("reads the flags a visitor's page was rendered under", () => {
    const featureToggles = [{ name: "template_marketplace", enabled: true, variant: { name: "disabled", enabled: false }, impressionData: false }];

    expect(readVisitorAccess({ visitorAccess: { featureToggles }, handle: "acme" })).toEqual({ featureToggles });
  });

  it("reads an empty list of flags as a visitor's page too", () => {
    expect(readVisitorAccess({ visitorAccess: { featureToggles: [] } })).toEqual({ featureToggles: [] });
  });

  it.each([
    ["page props of a member's page", { handle: "acme" }],
    ["no page props", undefined],
    ["null page props", null],
    ["page props that are not an object", "visitorAccess"],
    ["a null marker", { visitorAccess: null }],
    ["a marker that is not an object", { visitorAccess: true }],
    ["a marker without flags", { visitorAccess: {} }],
    ["a marker whose flags are not a list", { visitorAccess: { featureToggles: "all" } }]
  ])("reads %s as not a visitor's page", (_, pageProps) => {
    expect(readVisitorAccess(pageProps)).toBeUndefined();
  });
});
