import { describe, expect, it } from "vitest";

import { describeRoleWithArticle, getEditableRolesFor, getMemberDisplayName, getRoleRank } from "./organizationRoles";

describe("organizationRoles", () => {
  describe(describeRoleWithArticle.name, () => {
    it.each([
      ["owner", "an Owner"],
      ["admin", "an Admin"],
      ["member", "a Member"],
      ["billing", "a Billing"],
      ["viewer", "a Viewer"]
    ] as const)("describes %s as %s", (role, description) => {
      expect(describeRoleWithArticle(role)).toBe(description);
    });
  });

  describe(getEditableRolesFor.name, () => {
    it.each([
      ["member", ["member", "admin"]],
      ["admin", ["member", "admin"]],
      ["viewer", ["viewer", "member", "admin"]],
      ["billing", ["billing", "member", "admin"]]
    ] as const)("offers a %s the roles %o", (role, roles) => {
      expect(getEditableRolesFor(role)).toEqual(roles);
    });
  });

  describe(getMemberDisplayName.name, () => {
    it("prefers the username, then the email, then a placeholder", () => {
      expect(getMemberDisplayName({ username: "bob", email: "bob@acme.io" })).toBe("bob");
      expect(getMemberDisplayName({ username: null, email: "bob@acme.io" })).toBe("bob@acme.io");
      expect(getMemberDisplayName({ username: "", email: null })).toBe("Unnamed member");
    });
  });

  describe(getRoleRank.name, () => {
    it("ranks owners before admins before everyone else", () => {
      expect([getRoleRank("owner"), getRoleRank("admin"), getRoleRank("member"), getRoleRank("viewer"), getRoleRank("billing")]).toEqual([0, 1, 2, 2, 2]);
    });
  });
});
