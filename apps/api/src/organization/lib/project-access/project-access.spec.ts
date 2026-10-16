import { describe, expect, it } from "vitest";

import type { OrganizationRole, ProjectAccess } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { effectiveProjectAccessOf } from "./project-access";

describe(effectiveProjectAccessOf.name, () => {
  it.each<[OrganizationRole, ProjectAccess, ProjectAccess | null]>([
    ["owner", "selected", "all"],
    ["admin", "selected", "all"],
    ["billing", "all", null],
    ["member", "all", "all"],
    ["member", "selected", "selected"],
    ["viewer", "all", "all"],
    ["viewer", "selected", "selected"]
  ])("gives a %s stored as %s the access %s", (role, storedAccess, expected) => {
    expect(effectiveProjectAccessOf(role, storedAccess)).toBe(expected);
  });
});
