import type { SDLInput } from "@akashnetwork/chain-sdk";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it } from "vitest";

import { groupSpecsRequestGpuInterconnect, INTERCONNECT_GROUP_ATTRIBUTE_KEY, sdlRequestsGpuInterconnect } from "./gpu-interconnect";

describe("gpu-interconnect helpers", () => {
  describe(sdlRequestsGpuInterconnect.name, () => {
    it("returns false when SDL has no compute profiles", () => {
      expect(sdlRequestsGpuInterconnect(null)).toBe(false);
      expect(sdlRequestsGpuInterconnect(undefined)).toBe(false);
      expect(sdlRequestsGpuInterconnect({ profiles: {} } as unknown as SDLInput)).toBe(false);
    });

    it("returns false when no profile requests a gpu", () => {
      expect(sdlRequestsGpuInterconnect(buildSdl({ web: { gpu: false } }))).toBe(false);
    });

    it("returns false when gpu attributes have no interconnect opt-in", () => {
      expect(sdlRequestsGpuInterconnect(buildSdl({ web: { gpu: true } }))).toBe(false);
    });

    it("returns true for an implicit opt-in (empty sequence)", () => {
      expect(sdlRequestsGpuInterconnect(buildSdl({ web: { gpu: true, interconnect: [] } }))).toBe(true);
    });

    it("returns true for an explicit named group", () => {
      expect(sdlRequestsGpuInterconnect(buildSdl({ web: { gpu: true, interconnect: { group: "pair0" } } }))).toBe(true);
    });

    it("returns true when any one of several profiles opts in", () => {
      const sdl = buildSdl({
        web: { gpu: true },
        worker: { gpu: true, interconnect: [] }
      });

      expect(sdlRequestsGpuInterconnect(sdl)).toBe(true);
    });
  });

  describe(groupSpecsRequestGpuInterconnect.name, () => {
    it("returns false when groups is missing or empty", () => {
      expect(groupSpecsRequestGpuInterconnect(null)).toBe(false);
      expect(groupSpecsRequestGpuInterconnect(undefined)).toBe(false);
      expect(groupSpecsRequestGpuInterconnect([])).toBe(false);
    });

    it("returns false when gpu attributes carry only vendor/model keys", () => {
      const groups = buildGroupSpecs([[{ key: "vendor/nvidia/model/h100", value: "true" }]]);

      expect(groupSpecsRequestGpuInterconnect(groups)).toBe(false);
    });

    it("returns true when a resource carries the implicit interconnect group attribute", () => {
      const groups = buildGroupSpecs([
        [
          { key: "vendor/nvidia/model/h100", value: "true" },
          { key: INTERCONNECT_GROUP_ATTRIBUTE_KEY, value: "auto" }
        ]
      ]);

      expect(groupSpecsRequestGpuInterconnect(groups)).toBe(true);
    });

    it("returns true when a resource carries an explicit interconnect group attribute", () => {
      const groups = buildGroupSpecs([[{ key: INTERCONNECT_GROUP_ATTRIBUTE_KEY, value: "pair0" }]]);

      expect(groupSpecsRequestGpuInterconnect(groups)).toBe(true);
    });

    it("returns true when any one of several resources opts in", () => {
      const groups = buildGroupSpecs([[{ key: "vendor/nvidia/model/h100", value: "true" }], [{ key: INTERCONNECT_GROUP_ATTRIBUTE_KEY, value: "auto" }]]);

      expect(groupSpecsRequestGpuInterconnect(groups)).toBe(true);
    });
  });
});

function buildSdl(profiles: Record<string, { gpu: boolean; interconnect?: unknown[] | { group: string } }>): SDLInput {
  const compute: Record<string, unknown> = {};
  for (const [profileName, profile] of Object.entries(profiles)) {
    compute[profileName] = {
      resources: {
        cpu: { units: 1 },
        memory: { size: "512Mi" },
        storage: { size: "1Gi" },
        ...(profile.gpu && {
          gpu: {
            units: 1,
            attributes: {
              vendor: { nvidia: [{ model: "h100" }] },
              ...(profile.interconnect !== undefined && { interconnect: profile.interconnect })
            }
          }
        })
      }
    };
  }

  return {
    version: "2.0",
    profiles: { compute, placement: {} },
    deployment: {},
    services: {}
  } as unknown as SDLInput;
}

function buildGroupSpecs(resourceAttrs: { key: string; value: string }[][]): GroupSpec[] {
  return [
    {
      name: "test",
      requirements: undefined,
      resources: resourceAttrs.map(attrs => ({
        resource: {
          id: 1,
          cpu: undefined,
          memory: undefined,
          storage: [],
          gpu: { units: { val: "1" }, attributes: attrs },
          endpoints: []
        },
        count: 1,
        price: undefined
      }))
    } as unknown as GroupSpec
  ];
}
