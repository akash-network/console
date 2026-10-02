import { describe, expect, it } from "vitest";

import type { ServiceType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { describeCurrentConfiguration, describeRequestedGpuModels } from "./currentConfiguration";
import { MAX_GPU_MODEL_LENGTH, MAX_REGION_LENGTH } from "./hardwareRequestForm";

const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

describe(describeCurrentConfiguration.name, () => {
  it("summarizes a CPU-only service in the units the configure page shows", () => {
    const configuration = setup({ profile: { cpu: 1, ram: 2, ramUnit: "Gi", storage: [{ size: 512, unit: "Mi", isPersistent: false }] } });

    expect(configuration).toEqual({
      summary: "1 vCPU · 2 GiB memory · 512 MiB storage · Any region",
      cpu: 1,
      memoryBytes: 2 * GIB,
      storageBytes: 512 * MIB,
      region: null,
      gpu: undefined
    });
  });

  it("counts ephemeral and persistent storage together", () => {
    const configuration = setup({
      profile: {
        storage: [
          { size: 1, unit: "Gi", isPersistent: false },
          { size: 10, unit: "Gi", isPersistent: true }
        ]
      }
    });

    expect(configuration.storageBytes).toBe(11 * GIB);
    expect(configuration.summary).toContain("11 GiB storage");
  });

  it("names the region of the service's placement", () => {
    const configuration = setup({ regions: ["us-west"] });

    expect(configuration.region).toBe("us-west");
    expect(configuration.summary).toContain("· us-west");
    expect(configuration.summary).not.toContain("Any region");
  });

  it("lists every region the service's placement picks", () => {
    const configuration = setup({ regions: ["us-west", "eu-west"] });

    expect(configuration.region).toBe("us-west, eu-west");
    expect(configuration.summary).toContain("· us-west, eu-west");
  });

  it("names the first region and counts the rest when listing them all would pass the request's region limit", () => {
    const regions = Array.from({ length: 9 }, (_, index) => `na-us-southwest-${index}`);
    const configuration = setup({ regions });

    expect(regions.join(", ").length).toBeGreaterThan(MAX_REGION_LENGTH);
    expect(configuration.region).toBe("na-us-southwest-0 +8");
    expect(configuration.summary).toContain("· na-us-southwest-0 +8");
  });

  it("lists regions that exactly fill the request's region limit", () => {
    const regions = ["a".repeat(MAX_REGION_LENGTH - 3), "b"];
    const configuration = setup({ regions });

    expect(configuration.region).toBe(regions.join(", "));
  });

  it("falls back to any region when the service's placement picks none", () => {
    const configuration = setup({ regions: [] });

    expect(configuration.region).toBeNull();
    expect(configuration.summary).toContain("· Any region");
  });

  it("falls back to any region when the service's placement is missing", () => {
    const values = defaultServiceWithPlacement();
    values.services[0].placementId = "missing-placement";

    const configuration = describeCurrentConfiguration(values, 0, undefined);

    expect(configuration.region).toBeNull();
    expect(configuration.summary).toContain("· Any region");
  });

  it("includes the GPUs the service asks for", () => {
    const configuration = setup({
      profile: {
        hasGpu: true,
        gpu: 2,
        gpuModels: [
          { vendor: "nvidia", name: "h100", memory: "", interface: "" },
          { vendor: "nvidia", name: "a100", memory: "", interface: "" }
        ]
      },
      gpuCatalog: [{ name: "nvidia", models: [{ name: "h100", displayName: "H100", memory: [], interface: [] }] } as unknown as GpuVendor]
    });

    expect(configuration.gpu).toEqual({ count: 2, models: ["h100", "a100"] });
    expect(configuration.summary).toContain("vCPU · 2× H100 / A100 · ");
  });

  it("leaves the GPU out while the service has it turned off", () => {
    const configuration = setup({ profile: { hasGpu: false, gpu: 2, gpuModels: [{ vendor: "nvidia", name: "h100", memory: "", interface: "" }] } });

    expect(configuration.gpu).toBeUndefined();
    expect(configuration.summary).not.toContain("×");
  });

  it("leaves models the service did not pin out of the GPU models", () => {
    const configuration = setup({ profile: { hasGpu: true, gpu: 1, gpuModels: [{ vendor: "nvidia", name: "", memory: "", interface: "" }] } });

    expect(configuration.gpu).toEqual({ count: 1, models: [] });
    expect(configuration.summary).toContain("1× Any GPU");
  });

  it("describes one replica and names the replica count", () => {
    const configuration = setup({ count: 3, profile: { cpu: 2, ram: 4, ramUnit: "Gi" } });

    expect(configuration.cpu).toBe(2);
    expect(configuration.memoryBytes).toBe(4 * GIB);
    expect(configuration.summary).toMatch(/ · 3 replicas$/);
  });

  it("does not name a replica count for a single replica", () => {
    const configuration = setup({ count: 1 });

    expect(configuration.summary).not.toContain("replica");
  });

  it("reports whole bytes for fractional sizes", () => {
    const configuration = setup({ profile: { ram: 1.5, ramUnit: "Mi", storage: [{ size: 0.3, unit: "Mi", isPersistent: false }] } });

    expect(Number.isInteger(configuration.memoryBytes)).toBe(true);
    expect(Number.isInteger(configuration.storageBytes)).toBe(true);
  });

  function setup(input: {
    count?: number;
    regions?: string[];
    profile?: Partial<Omit<ServiceType["profile"], "storage">> & { storage?: Array<Partial<ServiceType["profile"]["storage"][number]>> };
    gpuCatalog?: GpuVendor[];
  }) {
    const values = defaultServiceWithPlacement({ count: input.count ?? 1 });
    const service = values.services[0];
    const { storage, ...profile } = input.profile ?? {};
    service.profile = {
      ...service.profile,
      hasGpu: false,
      gpu: 0,
      ...profile,
      storage: storage ? storage.map(entry => ({ ...service.profile.storage[0], ...entry })) : service.profile.storage
    };
    values.placements[0].regions = input.regions;

    return describeCurrentConfiguration(values, 0, input.gpuCatalog);
  }
});

describe(describeRequestedGpuModels.name, () => {
  it("names the models the service asks for as the catalog shows them", () => {
    const gpuModel = setup({ gpu: 2, models: ["h100", "a100"], gpuCatalog: [catalogVendor("nvidia", [["h100", "H100 SXM"]])] });

    expect(gpuModel).toBe("H100 SXM, A100");
  });

  it("names a model once however many of its variants are accepted", () => {
    const gpuModel = setup({ gpu: 1, models: ["h100", "h100"] });

    expect(gpuModel).toBe("H100");
  });

  it.each<[string, Parameters<typeof setup>[0]]>([
    ["while the service has its GPU turned off", { hasGpu: false, gpu: 1, models: ["h100"] }],
    ["while the service asks for no GPU unit", { gpu: 0, models: ["h100"] }],
    ["while the service accepts any model", { gpu: 1, models: ["h100", ""] }]
  ])("leaves the model blank %s", (_, input) => {
    expect(setup(input)).toBe("");
  });

  it("names the first model and counts the rest when the list would not fit the field", () => {
    const models = Array.from({ length: 12 }, (_, index) => `model-number-${index}`);

    const gpuModel = setup({ gpu: 1, models });

    expect(models.map(model => model.toUpperCase()).join(", ").length).toBeGreaterThan(MAX_GPU_MODEL_LENGTH);
    expect(gpuModel).toBe("MODEL-NUMBER-0 +11");
  });

  it("lists the models in full when they fill the field exactly", () => {
    const model = "m".repeat(MAX_GPU_MODEL_LENGTH);

    expect(setup({ gpu: 1, models: [model] })).toBe(model.toUpperCase());
  });

  function setup(input: { hasGpu?: boolean; gpu: number; models: string[]; gpuCatalog?: GpuVendor[] }) {
    const values = defaultServiceWithPlacement({ count: 1 });
    const service = values.services[0];
    service.profile = {
      ...service.profile,
      hasGpu: input.hasGpu ?? true,
      gpu: input.gpu,
      gpuModels: input.models.map(name => ({ vendor: "nvidia", name, memory: "", interface: "" }))
    };

    return describeRequestedGpuModels(values, 0, input.gpuCatalog);
  }

  function catalogVendor(name: string, models: Array<[string, string]>): GpuVendor {
    return { name, models: models.map(([modelName, displayName]) => ({ name: modelName, displayName, memory: [], interface: [] })) };
  }
});
