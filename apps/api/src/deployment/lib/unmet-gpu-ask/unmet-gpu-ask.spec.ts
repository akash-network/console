import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { GpuAsk, GpuAskSource } from "./unmet-gpu-ask";
import { classifyEmptyScreening, countGpus, findGpuAsks, findRegionArea, toAskToken, toDedupeKey } from "./unmet-gpu-ask";

describe("unmet gpu ask", () => {
  describe(findGpuAsks.name, () => {
    it("asks for a pinned model the gpus of every replica, in the area of the pinned region", () => {
      const source = aSource({ region: "eu-central", units: [aUnit({ gpus: 2, replicas: 3, keys: ["vendor/NVIDIA/model/H100/ram/80Gi"] })] });

      expect(findGpuAsks(source)).toEqual([{ vendor: "nvidia", model: "h100", gpuCount: 6, regionArea: "eu" }]);
    });

    it("adds up the units that ask for the same model", () => {
      const source = aSource({ units: [aUnit({ gpus: 1, keys: ["vendor/nvidia/model/a100"] }), aUnit({ gpus: 4, keys: ["vendor/nvidia/model/a100"] })] });

      expect(findGpuAsks(source)).toEqual([{ vendor: "nvidia", model: "a100", gpuCount: 5, regionArea: null }]);
    });

    it("counts a unit's gpus toward each model it accepts, once per model however many variants it names", () => {
      const source = aSource({
        units: [aUnit({ gpus: 2, keys: ["vendor/nvidia/model/a100/ram/40Gi", "vendor/nvidia/model/a100/ram/80Gi", "vendor/nvidia/model/h100"] })]
      });

      expect(findGpuAsks(source)).toEqual([
        { vendor: "nvidia", model: "a100", gpuCount: 2, regionArea: null },
        { vendor: "nvidia", model: "h100", gpuCount: 2, regionArea: null }
      ]);
    });

    it("leaves the model open for a wildcard model or a vendor-only key", () => {
      const source = aSource({ units: [aUnit({ gpus: 1, keys: ["vendor/nvidia/model/*"] }), aUnit({ gpus: 2, keys: ["vendor/amd"] })] });

      expect(findGpuAsks(source)).toEqual([
        { vendor: "nvidia", model: null, gpuCount: 1, regionArea: null },
        { vendor: "amd", model: null, gpuCount: 2, regionArea: null }
      ]);
    });

    it("leaves the vendor and model open for a wildcard vendor, an unknown key or no gpu attribute", () => {
      const source = aSource({
        units: [aUnit({ gpus: 1, keys: ["vendor/*/model/*"] }), aUnit({ gpus: 1, keys: ["something/else"] }), aUnit({ gpus: 1, keys: [] })]
      });

      expect(findGpuAsks(source)).toEqual([{ vendor: null, model: null, gpuCount: 3, regionArea: null }]);
    });

    it("ignores an attribute not set to true", () => {
      const source = aSource({ units: [aUnit({ gpus: 1, keys: ["vendor/nvidia/model/h100"], value: "false" })] });

      expect(findGpuAsks(source)).toEqual([{ vendor: null, model: null, gpuCount: 1, regionArea: null }]);
    });

    it("asks for nothing when no unit asks for a gpu", () => {
      const source = aSource({ units: [aUnit({ gpus: 0, keys: ["vendor/nvidia/model/h100"] }), { count: 1 }] });

      expect(findGpuAsks(source)).toEqual([]);
    });
  });

  describe(countGpus.name, () => {
    it("adds up the gpus of every replica of every unit", () => {
      const source = aSource({ units: [aUnit({ gpus: 2, replicas: 2, keys: [] }), aUnit({ gpus: 0, keys: [] }), { count: 3 }, aUnit({ gpus: 1, keys: [] })] });

      expect(countGpus(source)).toBe(5);
    });
  });

  describe(findRegionArea.name, () => {
    it("maps the pinned location-region onto its area", () => {
      expect(findRegionArea(aSource({ region: "na-us-west", units: [] }))).toBe("us");
    });

    it("has no area when no region is pinned or the region maps to none", () => {
      expect(findRegionArea(aSource({ units: [] }))).toBeNull();
      expect(findRegionArea({ resources: [] })).toBeNull();
      expect(findRegionArea(aSource({ region: "af-south", units: [] }))).toBeNull();
    });

    it("ignores other placement attributes, even one shaped like a region", () => {
      const source: GpuAskSource = {
        requirements: {
          attributes: [
            { key: "datacenter", value: "eu-west" },
            { key: "location-region", value: "na-us-west" }
          ]
        },
        resources: []
      };

      expect(findRegionArea(source)).toBe("us");
    });
  });

  describe(toAskToken.name, () => {
    it("hashes the ask, its utc day and the asker", () => {
      const ask: GpuAsk = { vendor: "nvidia", model: "h100", gpuCount: 8, regionArea: "eu" };

      expect(toAskToken(ask, new Date("2026-11-06T23:59:59.999Z"), "user-1")).toBe(sha256("nvidia|h100|8|eu|2026-11-06|user-1"));
    });

    it("writes an open vendor, model or area as a wildcard", () => {
      const ask: GpuAsk = { vendor: null, model: null, gpuCount: 1, regionArea: null };

      expect(toAskToken(ask, new Date("2026-11-06T00:00:00Z"), "user-1")).toBe(sha256("*|*|1|*|2026-11-06|user-1"));
    });

    it("gives the same ask a different token on another day or from another asker", () => {
      const ask: GpuAsk = { vendor: "nvidia", model: "h100", gpuCount: 8, regionArea: null };
      const token = toAskToken(ask, new Date("2026-11-06T10:00:00Z"), "user-1");

      expect(toAskToken(ask, new Date("2026-11-06T22:00:00Z"), "user-1")).toBe(token);
      expect(toAskToken(ask, new Date("2026-11-07T00:00:00Z"), "user-1")).not.toBe(token);
      expect(toAskToken(ask, new Date("2026-11-06T10:00:00Z"), "user-2")).not.toBe(token);
    });
  });

  describe(toDedupeKey.name, () => {
    it("hashes the kind with the ask token", () => {
      expect(toDedupeKey("no_fit", "token")).toBe(sha256("no_fit|token"));
    });
  });

  describe(classifyEmptyScreening.name, () => {
    const offered = [
      { vendor: "nvidia", model: "h100" },
      { vendor: "amd", model: "mi300x" }
    ];

    it("calls an ask some provider has the model for a miss of fit", () => {
      expect(classifyEmptyScreening({ vendor: "nvidia", model: "h100" }, offered)).toBe("no_fit");
    });

    it("calls an ask no provider has the model for a missing gpu", () => {
      expect(classifyEmptyScreening({ vendor: "nvidia", model: "b200" }, offered)).toBe("missing_gpu");
      expect(classifyEmptyScreening({ vendor: "intel", model: "h100" }, offered)).toBe("missing_gpu");
    });

    it("matches an open model on its vendor alone, and an open vendor on any gpu", () => {
      expect(classifyEmptyScreening({ vendor: "amd", model: null }, offered)).toBe("no_fit");
      expect(classifyEmptyScreening({ vendor: "intel", model: null }, offered)).toBe("missing_gpu");
      expect(classifyEmptyScreening({ vendor: null, model: null }, offered)).toBe("no_fit");
      expect(classifyEmptyScreening({ vendor: null, model: null }, [])).toBe("missing_gpu");
    });
  });

  function aSource(input: { region?: string; units: GpuAskSource["resources"] }): GpuAskSource {
    return { requirements: { attributes: input.region ? [{ key: "location-region", value: input.region }] : [] }, resources: input.units };
  }

  function aUnit(input: { gpus: number; replicas?: number; keys: string[]; value?: string }): GpuAskSource["resources"][number] {
    return {
      resource: { gpu: { units: { val: BigInt(input.gpus) }, attributes: input.keys.map(key => ({ key, value: input.value ?? "true" })) } },
      count: input.replicas ?? 1
    };
  }

  function sha256(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
});
