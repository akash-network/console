import { describe, expect, it } from "vitest";

import { deploymentLabelOf, listOf, systemCloseOf } from "./activityLabels";

describe("activityLabels", () => {
  describe(deploymentLabelOf.name, () => {
    it("quotes the deployment's name", () => {
      expect(deploymentLabelOf("web-api", "1234")).toBe("“web-api”");
    });

    it("falls back to the dseq for a deployment with no name", () => {
      expect(deploymentLabelOf(null, "1234")).toBe("deployment 1234");
    });
  });

  describe(listOf.name, () => {
    it("lists one label as it is", () => {
      expect(listOf(["a"])).toBe("a");
    });

    it("joins the last label with and", () => {
      expect(listOf(["a", "b", "c"])).toBe("a, b and c");
    });

    it("counts the labels past the third instead of naming them", () => {
      expect(listOf(["a", "b", "c", "d", "e"])).toBe("a, b, c and 2 more");
    });
  });

  describe(systemCloseOf.name, () => {
    it.each([
      ["runtime_limit_reached", "It reached its runtime limit."],
      ["trial_ended", "It reached the time limit for trial deployments."],
      ["provider_unreachable", "Its provider stopped responding."],
      ["no_lease", "It never got a lease, so its deposit was returned."]
    ])("says Console closed the deployment and why, for %s", (reason, detail) => {
      expect(systemCloseOf("“web-api”", reason)).toEqual({ title: "Console closed “web-api”", detail });
    });

    it("says only that the deployment no longer runs for a reason it has no words for", () => {
      expect(systemCloseOf("deployment 1234", "maintenance")).toEqual({
        title: "Console closed deployment 1234",
        detail: "It no longer runs or costs anything."
      });
    });

    it("says only that the deployment no longer runs when no reason is given", () => {
      expect(systemCloseOf("deployment 1234", undefined).detail).toBe("It no longer runs or costs anything.");
    });
  });
});
