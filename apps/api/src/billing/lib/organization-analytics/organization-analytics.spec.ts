import { describe, expect, it } from "vitest";

import { organizationAnalyticsProperties } from "./organization-analytics";

describe("organizationAnalyticsProperties", () => {
  it("names the organization and its type", () => {
    expect(organizationAnalyticsProperties({ id: "org-1", type: "team" })).toEqual({ organization_id: "org-1", organization_type: "team" });
  });

  it("adds nothing without an organization", () => {
    expect(organizationAnalyticsProperties(undefined)).toEqual({});
    expect(organizationAnalyticsProperties({ id: null, type: "personal" })).toEqual({});
  });
});
