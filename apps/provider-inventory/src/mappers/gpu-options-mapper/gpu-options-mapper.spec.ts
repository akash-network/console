import { describe, expect, it } from "vitest";

import type { AvailableGpu } from "@src/repositories/placement-options/placement-options.repository";
import { mapToGpuVendorOptions } from "./gpu-options-mapper";

describe(mapToGpuVendorOptions.name, () => {
  it("groups models under their vendor", () => {
    const options = mapToGpuVendorOptions([gpu({ vendor: "nvidia", model: "a100" }), gpu({ vendor: "amd", model: "mi100" })]);

    expect(options).toEqual([
      { vendor: "nvidia", models: [{ name: "a100", memory: ["40Gi"], interface: ["pcie"] }] },
      { vendor: "amd", models: [{ name: "mi100", memory: ["40Gi"], interface: ["pcie"] }] }
    ]);
  });

  it("collects every memory size and interface a model is available with", () => {
    const options = mapToGpuVendorOptions([
      gpu({ model: "a100", memory: "40Gi", interface: "pcie" }),
      gpu({ model: "a100", memory: "80Gi", interface: "sxm" }),
      gpu({ model: "a100", memory: "80Gi", interface: "pcie" })
    ]);

    expect(options).toEqual([{ vendor: "nvidia", models: [{ name: "a100", memory: ["40Gi", "80Gi"], interface: ["pcie", "sxm"] }] }]);
  });

  it("leaves out memory sizes and interfaces the provider did not report", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "h100", memory: "", interface: "" })]);

    expect(options).toEqual([{ vendor: "nvidia", models: [{ name: "h100", memory: [], interface: [] }] }]);
  });

  it("keeps every distinct model of a vendor", () => {
    const options = mapToGpuVendorOptions([gpu({ model: "a100" }), gpu({ model: "h100" }), gpu({ model: "a100" })]);

    expect(options[0].models.map(model => model.name)).toEqual(["a100", "h100"]);
  });

  it("returns no vendor when nothing is available", () => {
    expect(mapToGpuVendorOptions([])).toEqual([]);
  });

  function gpu(input: Partial<AvailableGpu>): AvailableGpu {
    return {
      vendor: input.vendor ?? "nvidia",
      model: input.model ?? "a100",
      memory: input.memory ?? "40Gi",
      interface: input.interface ?? "pcie"
    };
  }
});
