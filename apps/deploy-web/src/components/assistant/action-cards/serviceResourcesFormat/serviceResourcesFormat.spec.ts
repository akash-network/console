import { describe, expect, it } from "vitest";

import { computeLabelOf, gpuLabelOf } from "./serviceResourcesFormat";

describe("serviceResourcesFormat", () => {
  describe(gpuLabelOf.name, () => {
    it("names the count and models", () => {
      expect(gpuLabelOf({ units: 2, models: ["nvidia/rtx4090", "nvidia/a100"] })).toBe("2× RTX4090 or A100");
    });

    it("says any GPU when no model is required", () => {
      expect(gpuLabelOf({ units: 1, models: [] })).toBe("1× any GPU");
    });

    it("says none without a GPU", () => {
      expect(gpuLabelOf(null)).toBe("none");
    });
  });

  describe(computeLabelOf.name, () => {
    it("joins CPU, memory and every storage volume", () => {
      expect(computeLabelOf({ cpu: 8, memory: "32Gi", storage: ["10Gi", "100Gi"], gpu: null, count: 1 })).toBe("8 CPU / 32Gi / 10Gi + 100Gi");
    });

    it("marks unknown values and missing storage", () => {
      expect(computeLabelOf({ cpu: null, memory: null, storage: [], gpu: null, count: null })).toBe("? / ? / no storage");
    });
  });
});
