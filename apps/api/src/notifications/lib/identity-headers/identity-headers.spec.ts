import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { OrganizationContext } from "@src/organization/types/organization-context";
import { NOTIFICATIONS_IDENTITY_HEADERS, organizationIdentityHeaders, stripIdentityHeaders } from "./identity-headers";

describe(stripIdentityHeaders.name, () => {
  it("drops every header on the identity list and keeps the others", () => {
    const identityHeaders = Object.fromEntries(Object.values(NOTIFICATIONS_IDENTITY_HEADERS).map(name => [name, faker.string.uuid()]));

    const forwarded = stripIdentityHeaders({ ...identityHeaders, accept: "application/json", "x-request-id": faker.string.uuid() });

    expect(forwarded).toEqual({ accept: "application/json", "x-request-id": expect.any(String) });
  });

  it("drops an identity header whatever its letter case", () => {
    const forwarded = stripIdentityHeaders({ "X-Organization-Id": faker.string.uuid(), "X-USER-ID": faker.string.uuid() });

    expect(forwarded).toEqual({});
  });

  it("reserves the user, organization and project headers", () => {
    expect(Object.values(NOTIFICATIONS_IDENTITY_HEADERS)).toEqual(
      expect.arrayContaining(["x-user-id", "x-owner-address", "x-organization-id", "x-organization-role", "x-project-scope", "x-project-id"])
    );
  });
});

describe(organizationIdentityHeaders.name, () => {
  it("names only the organization while legacy rules apply", () => {
    const context = createOrganizationContext({ mode: "legacy" });

    expect(organizationIdentityHeaders(context)).toEqual({ "x-organization-id": context.organizationId });
  });

  it("names the organization, role and project scope while organization rules apply", () => {
    const context = createOrganizationContext({ mode: "organization", role: "viewer", projectScope: { kind: "projects", projectIds: [faker.string.uuid()] } });

    expect(organizationIdentityHeaders(context)).toEqual({
      "x-organization-id": context.organizationId,
      "x-organization-role": "viewer",
      "x-project-scope": JSON.stringify(context.projectScope)
    });
  });

  function createOrganizationContext(overrides: Partial<OrganizationContext>): OrganizationContext {
    return { organizationId: faker.string.uuid(), organizationType: "team", role: "owner", projectScope: { kind: "all" }, mode: "organization", ...overrides };
  }
});
