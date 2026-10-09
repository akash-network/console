import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { readRequestIdentity } from "./request-identity";

describe(readRequestIdentity.name, () => {
  it("reads a user without an organization", () => {
    const userId = faker.string.uuid();

    expect(readRequestIdentity({ "x-user-id": userId })).toEqual({ userId, organizationId: null, projectId: null, membership: null });
  });

  it("reads the organization and project to stamp without a membership when no role is minted", () => {
    const { headers, userId, organizationId, projectId } = setup();

    expect(readRequestIdentity({ ...headers, "x-project-scope": JSON.stringify({ kind: "all" }) })).toEqual({
      userId,
      organizationId,
      projectId,
      membership: null
    });
  });

  it("reads the membership when a role is minted", () => {
    const { headers, userId, organizationId, projectId } = setup();
    const projectScope = { kind: "projects", projectIds: [projectId] };

    expect(readRequestIdentity({ ...headers, "x-organization-role": "member", "x-project-scope": JSON.stringify(projectScope) })).toEqual({
      userId,
      organizationId,
      projectId,
      membership: { organizationId, role: "member", projectScope }
    });
  });

  it("reads a scope reaching every project", () => {
    const { headers, organizationId } = setup();

    expect(readRequestIdentity({ ...headers, "x-organization-role": "owner", "x-project-scope": JSON.stringify({ kind: "all" }) })?.membership).toEqual({
      organizationId,
      role: "owner",
      projectScope: { kind: "all" }
    });
  });

  it("rejects a request without a user", () => {
    const { headers } = setup();

    expect(readRequestIdentity({ ...headers, "x-user-id": undefined })).toBeUndefined();
    expect(readRequestIdentity({ ...headers, "x-user-id": "" })).toBeUndefined();
  });

  it("rejects identifiers that are not uuids", () => {
    const { headers } = setup();

    expect(readRequestIdentity({ ...headers, "x-organization-id": "acme" })).toBeUndefined();
    expect(readRequestIdentity({ ...headers, "x-project-id": "default" })).toBeUndefined();
  });

  it("rejects a role without an organization", () => {
    const { headers } = setup();

    expect(
      readRequestIdentity({ ...headers, "x-organization-id": undefined, "x-organization-role": "owner", "x-project-scope": JSON.stringify({ kind: "all" }) })
    ).toBeUndefined();
  });

  it("rejects a role that does not exist", () => {
    const { headers } = setup();

    expect(readRequestIdentity({ ...headers, "x-organization-role": "superuser", "x-project-scope": JSON.stringify({ kind: "all" }) })).toBeUndefined();
  });

  it("rejects a role without a readable project scope", () => {
    const { headers } = setup();

    expect(readRequestIdentity({ ...headers, "x-organization-role": "admin" })).toBeUndefined();
    expect(readRequestIdentity({ ...headers, "x-organization-role": "admin", "x-project-scope": "{" })).toBeUndefined();
    expect(readRequestIdentity({ ...headers, "x-organization-role": "admin", "x-project-scope": JSON.stringify({ kind: "projects" }) })).toBeUndefined();
    expect(
      readRequestIdentity({ ...headers, "x-organization-role": "admin", "x-project-scope": JSON.stringify({ kind: "projects", projectIds: ["default"] }) })
    ).toBeUndefined();
  });

  function setup() {
    const userId = faker.string.uuid();
    const organizationId = faker.string.uuid();
    const projectId = faker.string.uuid();
    const headers = { "x-user-id": userId, "x-organization-id": organizationId, "x-project-id": projectId };

    return { headers, userId, organizationId, projectId };
  }
});
