import { describe, expect, it } from "vitest";

import { LOG_COLLECTOR_IMAGE } from "@src/config/log-collector.config";
import type { PlacementOptions } from "@src/queries/usePlacementOptions";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { GpuVendor } from "@src/types/gpu";
import { defaultService } from "@src/utils/sdl/data";
import { candidateGpuModels, listGpuAvailabilityRows, rankGpuAlternatives, requestedGpuLabel, requestedGpuOf } from "./gpuAvailability";

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

describe(candidateGpuModels.name, () => {
  it("lists every model some provider has free, across vendors, in key order", () => {
    const candidates = candidateGpuModels(
      options([
        { vendor: "nvidia", models: [model("t4", 2), model("a100", 6)] },
        { vendor: "amd", models: [model("mi300", 1)] }
      ]),
      null
    );

    expect(candidates).toEqual([
      { key: "amd/mi300", vendor: "amd", name: "mi300" },
      { key: "nvidia/a100", vendor: "nvidia", name: "a100" },
      { key: "nvidia/t4", vendor: "nvidia", name: "t4" }
    ]);
  });

  it("leaves out the model already requested and models nobody has free", () => {
    const candidates = candidateGpuModels(options([{ vendor: "nvidia", models: [model("h100", 4), model("a100", 0), model("t4", 2)] }]), {
      vendor: "nvidia",
      name: "h100"
    });

    expect(candidates.map(candidate => candidate.key)).toEqual(["nvidia/t4"]);
  });

  it("keeps a model of the same name from another vendor", () => {
    const candidates = candidateGpuModels(
      options([
        { vendor: "amd", models: [model("h100", 1)] },
        { vendor: "nvidia", models: [model("h100", 1)] }
      ]),
      { vendor: "nvidia", name: "h100" }
    );

    expect(candidates.map(candidate => candidate.key)).toEqual(["amd/h100"]);
  });

  it("lists nothing without placement options", () => {
    expect(candidateGpuModels(undefined, null)).toEqual([]);
  });

  function options(gpus: PlacementOptions["gpus"]): PlacementOptions {
    return { regions: [], regionProviderCounts: {}, gpus };
  }

  function model(name: string, providerCount: number): PlacementOptions["gpus"][number]["models"][number] {
    return { name, memory: [], interface: [], providerCount, availableUnits: providerCount, maxNodeFreeUnits: 1, variants: [] };
  }
});

describe(rankGpuAlternatives.name, () => {
  it("lists the models that fit, the most providers first, with their display names", () => {
    const models = rankGpuAlternatives([candidate("nvidia", "h100"), candidate("nvidia", "rtx4090"), candidate("nvidia", "a100")], counts([4, 9, 6]), CATALOG);

    expect(models).toEqual([
      { key: "nvidia/rtx4090", label: "RTX 4090", providerCount: 9 },
      { key: "nvidia/a100", label: "A100", providerCount: 6 },
      { key: "nvidia/h100", label: "H100", providerCount: 4 }
    ]);
  });

  it("leaves out models that fit no provider or whose count is unknown", () => {
    const models = rankGpuAlternatives([candidate("nvidia", "h100"), candidate("nvidia", "a100"), candidate("nvidia", "t4")], counts([0, 2, null]), CATALOG);

    expect(models.map(entry => entry.key)).toEqual(["nvidia/a100"]);
  });

  it("orders models with the same count by label", () => {
    const models = rankGpuAlternatives([candidate("nvidia", "t4"), candidate("nvidia", "a100")], counts([2, 2]), undefined);

    expect(models.map(entry => entry.label)).toEqual(["A100", "T4"]);
  });

  it("keeps the five models with the most providers", () => {
    const candidates = ["a", "b", "c", "d", "e", "f"].map(name => candidate("nvidia", name));

    const models = rankGpuAlternatives(candidates, counts([1, 2, 3, 4, 5, 6]), undefined);

    expect(models.map(entry => entry.key)).toEqual(["nvidia/f", "nvidia/e", "nvidia/d", "nvidia/c", "nvidia/b"]);
  });

  it("treats a candidate without a count as not fitting", () => {
    expect(rankGpuAlternatives([candidate("nvidia", "a100")], [], CATALOG)).toEqual([]);
  });

  function candidate(vendor: string, name: string) {
    return { key: `${vendor}/${name}`, vendor, name };
  }

  function counts(values: (number | null)[]) {
    return values.map(count => ({ count, isLoading: false }));
  }
});

describe(listGpuAvailabilityRows.name, () => {
  const ALTERNATIVES = [
    { key: "nvidia/a100", label: "A100", providerCount: 15 },
    { key: "nvidia/t4", label: "T4", providerCount: 10 }
  ];

  it("lists the current request with its live count first, then the alternatives and no gpu", () => {
    const rows = listGpuAvailabilityRows({ requestedLabel: "H100", requestedCount: 16, alternatives: ALTERNATIVES, noGpuCount: 30, networkCount: 72 });

    expect(rows.map(({ key, label, providerCount, isCurrent }) => ({ key, label, providerCount, isCurrent }))).toEqual([
      { key: "current", label: "H100", providerCount: 16, isCurrent: true },
      { key: "nvidia/a100", label: "A100", providerCount: 15, isCurrent: false },
      { key: "nvidia/t4", label: "T4", providerCount: 10, isCurrent: false },
      { key: "no-gpu", label: "No GPU", providerCount: 30, isCurrent: false }
    ]);
  });

  it.each([
    ["unknown", null],
    ["zero", 0]
  ])("leaves no gpu out while its count is %s", (_, noGpuCount) => {
    const rows = listGpuAvailabilityRows({ requestedLabel: "H100", requestedCount: 16, alternatives: ALTERNATIVES, noGpuCount, networkCount: 72 });

    expect(rows.map(row => row.key)).toEqual(["current", "nvidia/a100", "nvidia/t4"]);
  });

  it("sizes each bar as a share of the network total, capped at a full bar", () => {
    const rows = listGpuAvailabilityRows({ requestedLabel: "H100", requestedCount: 30, alternatives: ALTERNATIVES, noGpuCount: null, networkCount: 20 });

    expect(rows.map(row => row.share)).toEqual([1, 0.75, 0.5]);
  });

  it("sizes each bar against the busiest row while the network total is unknown", () => {
    const rows = listGpuAvailabilityRows({ requestedLabel: "H100", requestedCount: 5, alternatives: ALTERNATIVES, noGpuCount: null, networkCount: null });

    expect(rows.map(row => row.share)).toEqual([1 / 3, 1, 2 / 3]);
  });

  it("draws no bar for a count still loading or a network without providers", () => {
    expect(listGpuAvailabilityRows({ requestedLabel: "H100", requestedCount: null, alternatives: [], noGpuCount: null, networkCount: 20 })[0].share).toBe(0);
    expect(listGpuAvailabilityRows({ requestedLabel: "H100", requestedCount: 0, alternatives: [], noGpuCount: null, networkCount: 0 })[0].share).toBe(0);
  });
});

function withGpu(
  service: SdlBuilderFormValuesType["services"][number],
  gpu: number,
  gpuModels: NonNullable<SdlBuilderFormValuesType["services"][number]["profile"]["gpuModels"]>
): SdlBuilderFormValuesType["services"][number] {
  return { ...service, placementId: service.placementId, profile: { ...service.profile, hasGpu: true, gpu, gpuModels } };
}
