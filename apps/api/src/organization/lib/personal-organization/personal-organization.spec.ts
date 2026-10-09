import { describe, expect, it } from "vitest";

import { MAX_ORGANIZATION_NAME_LENGTH } from "@src/organization/model-schemas/organization/organization.schema";
import { FALLBACK_PERSONAL_ORGANIZATION_NAME, personalOrganizationName, personalOrganizationSlug } from "./personal-organization";

const USER_ID = "0f1e2d3c-4b5a-6978-8796-a5b4c3d2e1f0";

describe(personalOrganizationSlug.name, () => {
  it("builds the slug from the first twelve hex characters of the user id", () => {
    expect(personalOrganizationSlug(USER_ID)).toBe("personal-0f1e2d3c4b5a");
  });

  it("numbers the slug from two once the previous ones collided", () => {
    expect(personalOrganizationSlug(USER_ID, 1)).toBe("personal-0f1e2d3c4b5a-2");
    expect(personalOrganizationSlug(USER_ID, 2)).toBe("personal-0f1e2d3c4b5a-3");
  });
});

describe(personalOrganizationName.name, () => {
  it("names the organization after the username", () => {
    expect(personalOrganizationName("alice")).toBe("alice");
  });

  it("falls back to a fixed name for a user without a username", () => {
    expect(personalOrganizationName(null)).toBe(FALLBACK_PERSONAL_ORGANIZATION_NAME);
    expect(personalOrganizationName("")).toBe(FALLBACK_PERSONAL_ORGANIZATION_NAME);
  });

  it("cuts a long username down to the organization name length", () => {
    const username = "a".repeat(MAX_ORGANIZATION_NAME_LENGTH + 10);

    expect(personalOrganizationName(username)).toBe(username.slice(0, MAX_ORGANIZATION_NAME_LENGTH));
  });
});
