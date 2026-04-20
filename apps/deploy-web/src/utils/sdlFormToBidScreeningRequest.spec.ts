import { describe, expect, it } from "vitest";

import type { PlacementFilters } from "./sdlFormToBidScreeningRequest";
import { sdlFormToBidScreeningRequest } from "./sdlFormToBidScreeningRequest";

describe(sdlFormToBidScreeningRequest.name, () => {
  it("converts a basic CPU-only service to a bid screening request", () => {
    const result = setup();

    expect(result).toEqual({
      data: {
        resources: [
          {
            cpu: 500,
            memory: 536870912,
            gpu: 0,
            ephemeralStorage: 1073741824,
            count: 1
          }
        ],
        requirements: {},
        limit: 200
      }
    });
  });

  it("converts GPU service with model attributes", () => {
    const result = setup({
      services: [
        makeService({
          profile: {
            cpu: 4,
            hasGpu: true,
            gpu: 2,
            gpuModels: [{ vendor: "nvidia", name: "a100", memory: "80Gi", interface: "PCIe" }],
            ram: 32,
            ramUnit: "Gi",
            storage: [{ size: 100, unit: "Gi", isPersistent: false }]
          },
          count: 3
        })
      ]
    });

    expect(result.data.resources[0]).toEqual({
      cpu: 4000,
      memory: 34359738368,
      gpu: 2,
      gpuAttributes: { vendor: "nvidia", model: "a100", memorySize: "80Gi", interface: "PCIe" },
      ephemeralStorage: 107374182400,
      count: 3
    });
  });

  it("includes persistent storage when present", () => {
    const result = setup({
      services: [
        makeService({
          profile: {
            cpu: 1,
            ram: 1,
            ramUnit: "Gi",
            storage: [
              { size: 1, unit: "Gi", isPersistent: false },
              { size: 10, unit: "Gi", isPersistent: true, type: "beta3", name: "data", mount: "/mnt/data" }
            ]
          }
        })
      ]
    });

    expect(result.data.resources[0].persistentStorage).toBe(10737418240);
    expect(result.data.resources[0].persistentStorageClass).toBe("beta3");
  });

  it("includes auditor signedBy from placement filters", () => {
    const result = setup({
      placementFilters: {
        maxPrice: null,
        auditedBy: ["akash1auditor1address"],
        regions: []
      }
    });

    expect(result.data.requirements).toEqual({
      signedBy: { anyOf: ["akash1auditor1address"] }
    });
  });

  it("maps multiple services to multiple resource units", () => {
    const result = setup({
      services: [
        makeService({ profile: { cpu: 0.5, ram: 512, ramUnit: "Mi", storage: [{ size: 1, unit: "Gi", isPersistent: false }] } }),
        makeService({ profile: { cpu: 2, ram: 4, ramUnit: "Gi", storage: [{ size: 10, unit: "Gi", isPersistent: false }] } })
      ]
    });

    expect(result.data.resources).toHaveLength(2);
    expect(result.data.resources[0].cpu).toBe(500);
    expect(result.data.resources[1].cpu).toBe(2000);
  });

  function makeService(overrides: Record<string, any> = {}) {
    return {
      id: "test-id",
      title: "service-1",
      image: "nginx",
      profile: {
        cpu: 0.5,
        hasGpu: false,
        gpu: 1,
        gpuModels: [{ vendor: "nvidia" }],
        ram: 512,
        ramUnit: "Mi",
        storage: [{ size: 1, unit: "Gi", isPersistent: false }],
        ...overrides.profile
      },
      expose: [{ id: "e1", port: 80, as: 80, proto: "http", global: true, to: [], accept: [], ipName: "", httpOptions: {} }],
      command: { command: "", arg: "" },
      env: [],
      placement: {
        name: "dcloud",
        pricing: { amount: 100000, denom: "uact" },
        signedBy: { anyOf: [], allOf: [] },
        attributes: []
      },
      count: 1,
      ...overrides
    };
  }

  function setup(input: { services?: any[]; placementFilters?: PlacementFilters } = {}) {
    const services = input.services ?? [makeService()];
    const placementFilters: PlacementFilters = input.placementFilters ?? {
      maxPrice: null,
      auditedBy: [],
      regions: []
    };

    return sdlFormToBidScreeningRequest({ services } as any, placementFilters);
  }
});
