import { describe, expect, it } from "vitest";

import { matchesGPU, normalizeGPUInterface, parseGPUAttributes } from "./gpu-attribute-parser";

describe(parseGPUAttributes.name, () => {
  it("parses vendor and model from attribute key", () => {
    const { results } = setup({ attributes: [{ key: "vendor/nvidia/model/a100", value: "true" }] });
    expect(results).toEqual([{ vendor: "nvidia", model: "a100", ram: null, interface: null }]);
  });

  it("handles wildcard model when model is not specified", () => {
    const { results } = setup({ attributes: [{ key: "vendor/nvidia", value: "true" }] });
    expect(results).toEqual([{ vendor: "nvidia", model: "*", ram: null, interface: null }]);
  });

  it("parses ram and interface optional fields", () => {
    const { results } = setup({ attributes: [{ key: "vendor/nvidia/model/a100/ram/80Gi/interface/pcie", value: "true" }] });
    expect(results[0].ram).toBe("80Gi");
    expect(results[0].interface).toBe("pcie");
  });

  it("ignores attributes with value other than true", () => {
    const { results } = setup({ attributes: [{ key: "vendor/nvidia/model/a100", value: "false" }] });
    expect(results).toEqual([]);
  });

  it("parses multiple GPU vendor attributes", () => {
    const { results } = setup({
      attributes: [
        { key: "vendor/nvidia/model/a100", value: "true" },
        { key: "vendor/amd/model/mi300x", value: "true" }
      ]
    });
    expect(results).toHaveLength(2);
    expect(results[0].vendor).toBe("nvidia");
    expect(results[1].vendor).toBe("amd");
  });

  it("throws for attribute key missing vendor", () => {
    expect(() => setup({ attributes: [{ key: "model/a100", value: "true" }] })).toThrow("missing vendor");
  });

  function setup(input: { attributes: { key: string; value: string }[] }) {
    const results = parseGPUAttributes(input.attributes);
    return { results };
  }
});

describe(normalizeGPUInterface.name, () => {
  it("normalizes sxm2 to sxm", () => {
    expect(normalizeGPUInterface("sxm2")).toBe("sxm");
  });

  it("normalizes SXM4 to sxm", () => {
    expect(normalizeGPUInterface("SXM4")).toBe("sxm");
  });

  it("lowercases pcie", () => {
    expect(normalizeGPUInterface("PCIe")).toBe("pcie");
  });
});

describe(matchesGPU.name, () => {
  it("matches exact vendor and model", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "a100", ram: null, interface: null }, { vendor: "nvidia", name: "a100", memorySize: "80Gi", interface: "PCIe" })
    ).toBe(true);
  });

  it("matches wildcard model against any model", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "*", ram: null, interface: null }, { vendor: "nvidia", name: "rtx4090", memorySize: "24Gi", interface: "PCIe" })
    ).toBe(true);
  });

  it("rejects mismatched vendor", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "a100", ram: null, interface: null }, { vendor: "amd", name: "a100", memorySize: "80Gi", interface: "PCIe" })
    ).toBe(false);
  });

  it("filters by RAM size when specified", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "a100", ram: "40Gi", interface: null }, { vendor: "nvidia", name: "a100", memorySize: "80Gi", interface: "PCIe" })
    ).toBe(false);
  });

  it("matches RAM size case-insensitively", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "a100", ram: "80gi", interface: null }, { vendor: "nvidia", name: "a100", memorySize: "80Gi", interface: "PCIe" })
    ).toBe(true);
  });

  it("filters by interface with sxm normalization", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "a100", ram: null, interface: "sxm2" }, { vendor: "nvidia", name: "a100", memorySize: "80Gi", interface: "SXM4" })
    ).toBe(true);
  });

  it("rejects mismatched interface", () => {
    expect(
      matchesGPU({ vendor: "nvidia", model: "a100", ram: null, interface: "pcie" }, { vendor: "nvidia", name: "a100", memorySize: "80Gi", interface: "SXM4" })
    ).toBe(false);
  });
});
