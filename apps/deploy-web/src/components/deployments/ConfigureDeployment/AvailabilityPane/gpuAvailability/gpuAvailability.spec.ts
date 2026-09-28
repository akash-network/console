import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { defaultService } from "@src/utils/sdl/data";
import { requestedGpuLabel, requestedGpuOf, topGpuModels } from "./gpuAvailability";

const CATALOG: GpuVendor[] = [
  {
    name: "nvidia",
    displayName: "NVIDIA",
    models: [
      { name: "rtx4090", displayName: "RTX 4090", memory: [], interface: [] },
      { name: "h100", displayName: "H100", memory: [], interface: [] }
    ]
  }
];

describe(requestedGpuOf.name, () => {
  it("returns the first model a GPU service of the placement asks for", () => {
    const services = [withGpu(defaultService("p1"), 1, [{ vendor: "nvidia", name: "h100" }])];

    expect(requestedGpuOf(services, "p1")).toEqual({ vendor: "nvidia", name: "h100" });
  });

  it("returns no model name for a GPU service that accepts any model", () => {
    const services = [withGpu(defaultService("p1"), 2, [{ vendor: "nvidia" }])];

    expect(requestedGpuOf(services, "p1")).toEqual({ vendor: "nvidia", name: undefined });
  });

  it("falls back to any nvidia GPU for a GPU service with no model entry", () => {
    const services = [withGpu(defaultService("p1"), 1, [])];

    expect(requestedGpuOf(services, "p1")).toEqual({ vendor: "nvidia" });
  });

  it.each([
    ["no GPU service", [withGpu(defaultService("p1"), 0, [{ vendor: "nvidia", name: "h100" }])]],
    [
      "a GPU service switched off",
      [{ ...withGpu(defaultService("p1"), 2, [{ vendor: "nvidia", name: "h100" }]), profile: { ...defaultService("p1").profile, hasGpu: false, gpu: 2 } }]
    ],
    ["a GPU service in another placement", [withGpu(defaultService("p2"), 1, [{ vendor: "nvidia", name: "h100" }])]],
    [
      "a GPU log collector",
      [withGpu({ ...defaultService("p1", { title: "web-log-collector" }), image: LOG_COLLECTOR_IMAGE }, 1, [{ vendor: "nvidia", name: "h100" }])]
    ]
  ])("returns null for %s", (_, services) => {
    expect(requestedGpuOf(services, "p1")).toBeNull();
  });

  it("returns null without services", () => {
    expect(requestedGpuOf(undefined, "p1")).toBeNull();
  });
});

describe(requestedGpuLabel.name, () => {
  it.each([
    ["No GPU", null],
    ["Any GPU", { vendor: "nvidia" }],
    ["RTX 4090", { vendor: "nvidia", name: "rtx4090" }],
    ["MI300", { vendor: "amd", name: "mi300" }]
  ])("labels the request as %s", (label, requested) => {
    expect(requestedGpuLabel(requested, CATALOG)).toBe(label);
  });
});

describe(topGpuModels.name, () => {
  it("lists the models the most providers could serve, busiest first, with their display names", () => {
    const models = topGpuModels(options([{ vendor: "nvidia", models: [model("h100", 4), model("rtx4090", 9), model("a100", 6)] }]), CATALOG, null);

    expect(models).toEqual([
      { key: "nvidia/rtx4090", label: "RTX 4090", providerCount: 9 },
      { key: "nvidia/a100", label: "A100", providerCount: 6 },
      { key: "nvidia/h100", label: "H100", providerCount: 4 }
    ]);
  });

  it("keeps the five busiest models across vendors", () => {
    const models = topGpuModels(
      options([
        { vendor: "nvidia", models: [model("a", 1), model("b", 2), model("c", 3), model("d", 4)] },
        { vendor: "amd", models: [model("e", 5), model("f", 6)] }
      ]),
      undefined,
      null
    );

    expect(models.map(entry => entry.key)).toEqual(["amd/f", "amd/e", "nvidia/d", "nvidia/c", "nvidia/b"]);
  });

  it("leaves out the model already requested and models nobody can serve", () => {
    const models = topGpuModels(options([{ vendor: "nvidia", models: [model("h100", 4), model("a100", 0), model("t4", 2)] }]), CATALOG, {
      vendor: "nvidia",
      name: "h100"
    });

    expect(models.map(entry => entry.key)).toEqual(["nvidia/t4"]);
  });

  it("lists nothing without placement options", () => {
    expect(topGpuModels(undefined, CATALOG, null)).toEqual([]);
  });

  function options(gpus: PlacementOptions["gpus"]): PlacementOptions {
    return { regions: [], regionProviderCounts: {}, gpus };
  }

  function model(name: string, providerCount: number): PlacementOptions["gpus"][number]["models"][number] {
    return { name, memory: [], interface: [], providerCount, variants: [] };
  }
});

function withGpu(
  service: SdlBuilderFormValuesType["services"][number],
  gpu: number,
  gpuModels: NonNullable<SdlBuilderFormValuesType["services"][number]["profile"]["gpuModels"]>
): SdlBuilderFormValuesType["services"][number] {
  return { ...service, placementId: service.placementId, profile: { ...service.profile, hasGpu: true, gpu, gpuModels } };
}
