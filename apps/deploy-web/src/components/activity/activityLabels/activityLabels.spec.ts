import { describe, expect, it } from "vitest";

import { deploymentLabelOf, listOf } from "./activityLabels";

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
});
