import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { NOTIFICATIONS_IDENTITY_HEADERS, stripIdentityHeaders } from "./identity-headers";

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
