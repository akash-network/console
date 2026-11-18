import { describe, expect, it } from "vitest";

import type { GpuSupplyRow } from "@src/gpu-waitlist/services/gpu-supply-http/gpu-supply-http.service";
import { summarizePoolSupply, toGpuSetupInterface } from "./pool-supply";

const ANY_KIND = { memory: null, interface: null };

describe(summarizePoolSupply.name, () => {
  it("ignores providers without bid evidence", () => {
    const rows = [aRow({ owner: "bidder", units: 4 }), aRow({ owner: "silent", units: 8 })];

    expect(summarizePoolSupply(rows, new Set(["bidder"]), ANY_KIND)).toEqual({ freeUnits: 4, nodeFreeUnits: [4], providers: ["bidder"] });
  });

  it("matches memory and interface only when the pool sets them", () => {
    const rows = [
      aRow({ owner: "a", node: 1, memory: "80Gi", interface: "SXM5", units: 1 }),
      aRow({ owner: "a", node: 2, memory: "94Gi", interface: "sxm5", units: 2 }),
      aRow({ owner: "a", node: 3, memory: "80gi", interface: "pcie", units: 4 })
    ];
    const bidders = new Set(["a"]);

    expect(summarizePoolSupply(rows, bidders, ANY_KIND).nodeFreeUnits).toEqual([1, 2, 4]);
    expect(summarizePoolSupply(rows, bidders, { memory: "80Gi", interface: null }).nodeFreeUnits).toEqual([1, 4]);
    expect(summarizePoolSupply(rows, bidders, { memory: null, interface: "sxm" }).nodeFreeUnits).toEqual([1, 2]);
    expect(summarizePoolSupply(rows, bidders, { memory: "80gi", interface: "sxm5" }).nodeFreeUnits).toEqual([1]);
  });

  it("does not count a node's free gpus of another model", () => {
    const rows = [aRow({ owner: "a", units: 2, nodeFreeUnits: 6 })];

    expect(summarizePoolSupply(rows, new Set(["a"]), ANY_KIND)).toEqual({ freeUnits: 2, nodeFreeUnits: [2], providers: ["a"] });
  });

  it("counts a node with two matching kinds once", () => {
    const rows = [
      aRow({ owner: "a", node: 1, memory: "80Gi", units: 4, nodeFreeUnits: 6 }),
      aRow({ owner: "a", node: 1, memory: "94Gi", units: 4, nodeFreeUnits: 6 }),
      aRow({ owner: "b", node: 1, units: 3, nodeFreeUnits: 3 })
    ];

    expect(summarizePoolSupply(rows, new Set(["a", "b"]), ANY_KIND)).toEqual({ freeUnits: 9, nodeFreeUnits: [6, 3], providers: ["a", "b"] });
  });

  it("counts every device of the kind as free on a node reporting unlimited capacity", () => {
    const rows = [aRow({ owner: "a", units: 8, nodeFreeUnits: null })];

    expect(summarizePoolSupply(rows, new Set(["a"]), ANY_KIND)).toEqual({ freeUnits: 8, nodeFreeUnits: [8], providers: ["a"] });
  });

  it("leaves out nodes with nothing free and providers holding none", () => {
    const rows = [aRow({ owner: "a", units: 8, nodeFreeUnits: 0 }), aRow({ owner: "b", units: 2, nodeFreeUnits: 2 })];

    expect(summarizePoolSupply(rows, new Set(["a", "b"]), ANY_KIND)).toEqual({ freeUnits: 2, nodeFreeUnits: [2], providers: ["b"] });
  });

  it("caps the free total at the largest safe integer", () => {
    const rows = [aRow({ owner: "a", node: 1, units: Number.MAX_SAFE_INTEGER }), aRow({ owner: "a", node: 2, units: Number.MAX_SAFE_INTEGER })];

    expect(summarizePoolSupply(rows, new Set(["a"]), ANY_KIND).freeUnits).toBe(Number.MAX_SAFE_INTEGER);
  });

  function aRow(overrides: Partial<GpuSupplyRow>): GpuSupplyRow {
    return {
      owner: "akash1provider",
      node: 1,
      vendor: "nvidia",
      model: "h100",
      memory: "80Gi",
      interface: "sxm5",
      units: 8,
      nodeFreeUnits: null,
      ...overrides
    };
  }
});

describe(toGpuSetupInterface.name, () => {
  it("reads an interface by its family", () => {
    expect(toGpuSetupInterface("SXM5")).toBe("sxm");
    expect(toGpuSetupInterface("sxm")).toBe("sxm");
    expect(toGpuSetupInterface("PCIe")).toBe("pcie");
    expect(toGpuSetupInterface("pcie4")).toBe("pcie");
  });

  it("leaves out an interface no check can ask for", () => {
    expect(toGpuSetupInterface("nvlink")).toBeUndefined();
    expect(toGpuSetupInterface(null)).toBeUndefined();
    expect(toGpuSetupInterface("")).toBeUndefined();
  });
});
