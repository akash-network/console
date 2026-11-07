import { createMongoAbility, type MongoAbility, type RawRuleOf } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { findTemplateWriteRefusal, isInActiveOrganization } from "./template-write-access";

describe(findTemplateWriteRefusal.name, () => {
  it("allows a write the rules allow on a template of the active organization", () => {
    const organizationId = faker.string.uuid();

    expect(findTemplateWriteRefusal({ organizationId }, "update", accessOf(organizationId, [{ action: "update", subject: "Template" }]))).toBeUndefined();
  });

  it("refuses a template of another organization before consulting the rules", () => {
    const access = accessOf(faker.string.uuid(), [{ action: "manage", subject: "Template" }]);

    expect(findTemplateWriteRefusal({ organizationId: faker.string.uuid() }, "update", access)).toBe("outside_active_organization");
  });

  it.each<[string, string | null, string | undefined]>([
    ["a template filed in no organization", null, faker.string.uuid()],
    ["a request without an active organization", faker.string.uuid(), undefined],
    ["both", null, undefined]
  ])("refuses %s", (_case, organizationId, activeOrganizationId) => {
    const access = accessOf(activeOrganizationId, [{ action: "manage", subject: "Template" }]);

    expect(findTemplateWriteRefusal({ organizationId }, "update", access)).toBe("outside_active_organization");
  });

  it("refuses a template that names no organization when the request has no active organization either", () => {
    const access = accessOf(undefined, [{ action: "manage", subject: "Template" }]);

    expect(findTemplateWriteRefusal({}, "update", access)).toBe("outside_active_organization");
  });

  it("checks the action against every field of the template", () => {
    const organizationId = faker.string.uuid();
    const projectId = faker.string.uuid();
    const access = accessOf(organizationId, [{ action: "delete", subject: "Template", conditions: { projectId } }]);

    expect([
      findTemplateWriteRefusal({ organizationId, projectId }, "delete", access),
      findTemplateWriteRefusal({ organizationId, projectId: faker.string.uuid() }, "delete", access),
      findTemplateWriteRefusal({ organizationId, projectId }, "update", access)
    ]).toEqual([undefined, "not_permitted", "not_permitted"]);
  });

  function accessOf(activeOrganizationId: string | undefined, rules: RawRuleOf<MongoAbility>[]) {
    return { ability: createMongoAbility<MongoAbility>(rules), activeOrganizationId };
  }
});

describe(isInActiveOrganization.name, () => {
  it.each<[string, { organizationId?: string | null }, string | undefined, boolean]>([
    ["a template of the active organization", { organizationId: "org-1" }, "org-1", true],
    ["a template of another organization", { organizationId: "org-2" }, "org-1", false],
    ["a template filed in no organization", { organizationId: null }, "org-1", false],
    ["a request without an active organization", { organizationId: "org-1" }, undefined, false],
    ["a template naming no organization outside any organization", {}, undefined, false],
    ["an empty active organization", { organizationId: "" }, "", false]
  ])("answers for %s", (_case, template, activeOrganizationId, expected) => {
    expect(isInActiveOrganization(template, activeOrganizationId)).toBe(expected);
  });
});
