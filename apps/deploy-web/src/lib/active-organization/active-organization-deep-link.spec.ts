import { describe, expect, it } from "vitest";

import { removeActiveOrganizationQueryParam, resolveActiveOrganizationDeepLink } from "./active-organization-deep-link";

describe(resolveActiveOrganizationDeepLink.name, () => {
  it("returns the id of the membership whose id matches the org query value", () => {
    const { memberships } = setup();

    expect(resolveActiveOrganizationDeepLink("org-2", memberships)).toBe("org-2");
  });

  it("returns the id of the membership whose slug matches the org query value", () => {
    const { memberships } = setup();

    expect(resolveActiveOrganizationDeepLink("acme", memberships)).toBe("org-1");
  });

  it("returns null when the org query value is not one of the caller's organizations", () => {
    const { memberships } = setup();

    expect(resolveActiveOrganizationDeepLink("initech", memberships)).toBeNull();
  });

  it("returns null when the caller has no organizations", () => {
    expect(resolveActiveOrganizationDeepLink("acme", [])).toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["an empty string", ""]
  ])("returns null for %s", (_, value) => {
    const { memberships } = setup();

    expect(resolveActiveOrganizationDeepLink(value, memberships)).toBeNull();
  });

  it("returns null for a repeated org query param", () => {
    const { memberships } = setup();

    expect(resolveActiveOrganizationDeepLink(["acme", "globex"], memberships)).toBeNull();
  });

  function setup() {
    return {
      memberships: [
        { id: "org-1", slug: "acme" },
        { id: "org-2", slug: "globex" }
      ]
    };
  }
});

describe(removeActiveOrganizationQueryParam.name, () => {
  it("removes the org query param and keeps the other params", () => {
    expect(removeActiveOrganizationQueryParam("/deployments?org=acme&tab=active")).toBe("/deployments?tab=active");
  });

  it("drops the query string when org was the only param", () => {
    expect(removeActiveOrganizationQueryParam("/deployments?org=acme")).toBe("/deployments");
  });

  it("keeps the hash", () => {
    expect(removeActiveOrganizationQueryParam("/deployments/123?org=acme#logs")).toBe("/deployments/123#logs");
  });

  it("leaves a path without the org query param unchanged", () => {
    expect(removeActiveOrganizationQueryParam("/deployments?tab=active")).toBe("/deployments?tab=active");
  });
});
