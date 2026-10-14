import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it } from "vitest";

import { getProjectAccessErrorMessage, holdsProjectGrants } from "./projectAccess";

describe("projectAccess", () => {
  describe(holdsProjectGrants.name, () => {
    it.each(["member", "viewer"] as const)("gives a %s project grants", role => {
      expect(holdsProjectGrants(role)).toBe(true);
    });

    it.each(["owner", "admin", "billing"] as const)("gives a %s no project grants", role => {
      expect(holdsProjectGrants(role)).toBe(false);
    });
  });

  describe(getProjectAccessErrorMessage.name, () => {
    it.each([
      ["forbidden", "You can't manage access to this project."],
      ["implicit_project_access", "Owners and admins already open every project."],
      ["billing_role_not_grantable", "Billing members can't be given access to projects."],
      ["already_granted", "They already have access to this project."]
    ])("explains %s", (code, message) => {
      expect(getProjectAccessErrorMessage(new ApiError(409, { code }, "POST"), "fallback")).toBe(message);
    });

    it("falls back for a code it does not know", () => {
      expect(getProjectAccessErrorMessage(new ApiError(404, { code: "not_found" }, "POST"), "fallback")).toBe("fallback");
    });

    it("falls back for an error without a code", () => {
      expect(getProjectAccessErrorMessage(new Error("boom"), "fallback")).toBe("fallback");
    });
  });
});
