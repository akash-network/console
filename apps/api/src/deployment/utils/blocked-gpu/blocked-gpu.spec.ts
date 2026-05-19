import type { SDLInput } from "@akashnetwork/chain-sdk";
import type { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";

import { extractRequestedGpusFromGroupSpecs, extractRequestedGpusFromSdl, findBlockedGpus, toBlockedGpuSet } from "./blocked-gpu";

describe("blocked-gpu helpers", () => {
  describe("extractRequestedGpusFromSdl", () => {
    it("returns empty when SDL has no compute profiles", () => {
      expect(extractRequestedGpusFromSdl(null)).toEqual([]);
      expect(extractRequestedGpusFromSdl(undefined)).toEqual([]);
      expect(extractRequestedGpusFromSdl({ profiles: {} } as unknown as SDLInput)).toEqual([]);
    });

    it("returns empty when no compute profile has a gpu block", () => {
      expect(extractRequestedGpusFromSdl(buildSdl({}))).toEqual([]);
    });

    it("returns each requested vendor/model from a single profile", () => {
      const sdl = buildSdl({ gpu: { web: [{ vendor: "nvidia", models: [{ model: "h100" }, { model: "a100", ram: "80Gi" }] }] } });

      expect(extractRequestedGpusFromSdl(sdl)).toEqual([
        { vendor: "nvidia", model: "h100" },
        { vendor: "nvidia", model: "a100" }
      ]);
    });

    it("aggregates across multiple compute profiles and vendors", () => {
      const sdl = buildSdl({
        gpu: {
          web: [{ vendor: "nvidia", models: [{ model: "h100" }] }],
          worker: [{ vendor: "amd", models: [{ model: "mi300x" }] }]
        }
      });

      expect(extractRequestedGpusFromSdl(sdl)).toEqual([
        { vendor: "nvidia", model: "h100" },
        { vendor: "amd", model: "mi300x" }
      ]);
    });

    it("lowercases vendor and model", () => {
      const sdl = buildSdl({ gpu: { web: [{ vendor: "NVIDIA", models: [{ model: "H100" }] }] } });

      expect(extractRequestedGpusFromSdl(sdl)).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });

    it("skips entries without a model", () => {
      const sdl = buildSdl({ gpu: { web: [{ vendor: "nvidia", models: [{}, { model: "h100" }] as unknown as { model: string }[] }] } });

      expect(extractRequestedGpusFromSdl(sdl)).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });
  });

  describe("extractRequestedGpusFromGroupSpecs", () => {
    it("returns empty when groups is missing or empty", () => {
      expect(extractRequestedGpusFromGroupSpecs(null)).toEqual([]);
      expect(extractRequestedGpusFromGroupSpecs([])).toEqual([]);
    });

    it("parses vendor/model from on-chain attribute keys", () => {
      const groups = buildGroupSpecs([
        [{ key: "vendor/nvidia/model/h100", value: "true" }],
        [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/sxm", value: "true" }]
      ]);

      expect(extractRequestedGpusFromGroupSpecs(groups)).toEqual([
        { vendor: "nvidia", model: "h100" },
        { vendor: "nvidia", model: "a100" }
      ]);
    });

    it("ignores attributes where value !== 'true'", () => {
      const groups = buildGroupSpecs([[{ key: "vendor/nvidia/model/h100", value: "false" }]]);
      expect(extractRequestedGpusFromGroupSpecs(groups)).toEqual([]);
    });

    it("ignores keys missing vendor or model", () => {
      const groups = buildGroupSpecs([
        [
          { key: "model/h100", value: "true" },
          { key: "vendor/nvidia", value: "true" }
        ]
      ]);
      expect(extractRequestedGpusFromGroupSpecs(groups)).toEqual([]);
    });
  });

  describe("findBlockedGpus", () => {
    it("returns empty when blocked set is empty", () => {
      expect(findBlockedGpus([{ vendor: "nvidia", model: "h100" }], toBlockedGpuSet([]))).toEqual([]);
    });

    it("returns empty when requested list is empty", () => {
      expect(findBlockedGpus([], toBlockedGpuSet(["nvidia/h100"]))).toEqual([]);
    });

    it("matches case-insensitively on vendor/model", () => {
      expect(findBlockedGpus([{ vendor: "nvidia", model: "h100" }], toBlockedGpuSet(["NVIDIA/H100"]))).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });

    it("returns only the intersection", () => {
      const requested = [
        { vendor: "nvidia", model: "h100" },
        { vendor: "nvidia", model: "rtx-4090" }
      ];

      expect(findBlockedGpus(requested, toBlockedGpuSet(["nvidia/h100", "nvidia/h200"]))).toEqual([{ vendor: "nvidia", model: "h100" }]);
    });
  });
});

type GpuEntry = { vendor: string; models: { model?: string; ram?: string }[] };

function buildSdl(input: { gpu?: Record<string, GpuEntry[]> }): SDLInput {
  const compute: SDLInput["profiles"]["compute"] = {};
  for (const [profileName, vendors] of Object.entries(input.gpu ?? {})) {
    const vendorMap: Record<string, { model?: string; ram?: string }[]> = {};
    for (const v of vendors) {
      vendorMap[v.vendor] = v.models;
    }
    compute[profileName] = {
      resources: {
        cpu: { units: 1 },
        memory: { size: "512Mi" },
        storage: { size: "1Gi" },
        gpu: { units: 1, attributes: { vendor: vendorMap } }
      }
    } as SDLInput["profiles"]["compute"][string];
  }
  if (Object.keys(compute).length === 0) {
    compute["web"] = {
      resources: {
        cpu: { units: 1 },
        memory: { size: "512Mi" },
        storage: { size: "1Gi" }
      }
    } as SDLInput["profiles"]["compute"][string];
  }

  return {
    version: "2.0",
    profiles: { compute, placement: {} },
    deployment: {},
    services: {}
  } as SDLInput;
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
