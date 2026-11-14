import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import type { OrganizationContext } from "@src/organization/types/organization-context";
import { accountEmailHeaders, NOTIFICATIONS_IDENTITY_HEADERS, organizationIdentityHeaders, stripIdentityHeaders } from "./identity-headers";

import { createProjectsScope } from "@test/seeders/organization-context.seeder";

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

  it("reserves the user, account email, organization and project headers", () => {
    expect(Object.values(NOTIFICATIONS_IDENTITY_HEADERS)).toEqual(
      expect.arrayContaining([
        "x-user-id",
        "x-owner-address",
        "x-organization-id",
        "x-organization-type",
        "x-organization-role",
        "x-project-scope",
        "x-project-id",
        "x-user-email",
        "x-user-email-verified"
      ])
    );
  });
});

describe(accountEmailHeaders.name, () => {
  it("names the email Auth0 reports verified as the verified account email", () => {
    expect(accountEmailHeaders({ email: "other@example.com", verifiedEmail: "owner@example.com" })).toEqual({
      "x-user-email": "owner@example.com",
      "x-user-email-verified": "true"
    });
  });

  it("names the account email as unverified while Auth0 reports no verified email", () => {
    expect(accountEmailHeaders({ email: "owner@example.com", verifiedEmail: null })).toEqual({
      "x-user-email": "owner@example.com",
      "x-user-email-verified": "false"
    });
  });

  it("names nothing for an account without an email", () => {
    expect(accountEmailHeaders({ email: null, verifiedEmail: null })).toEqual({});
  });
});

describe(organizationIdentityHeaders.name, () => {
  it("names the organization, role and project scope", () => {
    const context = createOrganizationContext({ role: "viewer", projectScope: createProjectsScope([faker.string.uuid()]) });

    expect(organizationIdentityHeaders(context)).toEqual({
      "x-organization-id": context.organizationId,
      "x-organization-type": context.organizationType,
      "x-organization-role": "viewer",
      "x-project-scope": JSON.stringify(context.projectScope)
    });
  });

  function createOrganizationContext(overrides: Partial<OrganizationContext>): OrganizationContext {
    return { organizationId: faker.string.uuid(), organizationType: "team", role: "owner", projectScope: { kind: "all" }, ...overrides };
  }
});
