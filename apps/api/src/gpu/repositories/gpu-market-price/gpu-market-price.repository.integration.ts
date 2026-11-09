import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { type GpuMarketPriceInsert, GpuMarketPriceRepository } from "./gpu-market-price.repository";

const COMPUTED_AT = new Date("2026-11-06T03:37:00.000Z");

describe(GpuMarketPriceRepository.name, () => {
  describe("replaceAll", () => {
    it("replaces every stored row with the new ones", async () => {
      const { repository } = setup();
      await repository.replaceAll([aRow({ model: "a100" }), aRow({ model: "h100" })]);

      await repository.replaceAll([aRow({ model: "h200", medianUsdPerGpuHour: 3.1 })]);

      expect(await repository.findAllOrdered()).toEqual([expect.objectContaining({ model: "h200", medianUsdPerGpuHour: 3.1, computedAt: COMPUTED_AT })]);
    });

    it("empties the table when there is nothing to store", async () => {
      const { repository } = setup();
      await repository.replaceAll([aRow({})]);

      await repository.replaceAll([]);

      expect(await repository.findAllOrdered()).toEqual([]);
    });

    it("keeps the previous rows when the new ones fail to insert", async () => {
      const { repository } = setup();
      await repository.replaceAll([aRow({ model: "a100" })]);

      await expect(repository.replaceAll([aRow({ model: "x".repeat(300) })])).rejects.toThrow();

      expect((await repository.findAllOrdered()).map(row => row.model)).toEqual(["a100"]);
    });
  });

  describe("findAllOrdered", () => {
    it("orders rows by vendor, model, variant, area and source, the region-wide row last", async () => {
      const { repository } = setup();
      await repository.replaceAll([
        aRow({ model: "h100", area: "us", source: "lease" }),
        aRow({ model: "h100", area: null, source: "bid" }),
        aRow({ model: "h100", area: "us", source: "bid" }),
        aRow({ model: "h100", interface: "pcie", area: null }),
        aRow({ model: "a100", area: null }),
        aRow({ vendor: "amd", model: "mi300x", area: null })
      ]);

      const rows = await repository.findAllOrdered();

      expect(rows.map(row => [row.vendor, row.model, row.interface, row.area, row.source])).toEqual([
        ["amd", "mi300x", "sxm", null, "bid"],
        ["nvidia", "a100", "sxm", null, "bid"],
        ["nvidia", "h100", "pcie", null, "bid"],
        ["nvidia", "h100", "sxm", "us", "bid"],
        ["nvidia", "h100", "sxm", "us", "lease"],
        ["nvidia", "h100", "sxm", null, "bid"]
      ]);
    });
  });

  describe("when filtering by vendor and model", () => {
    it("keeps only matching rows, regardless of case", async () => {
      const { repository } = setup();
      await repository.replaceAll([aRow({ model: "H100" }), aRow({ model: "a100" }), aRow({ vendor: "amd", model: "h100" })]);

      const byVendorAndModel = await repository.findAllOrdered({ vendor: "NVIDIA", model: "h100" });
      const byModel = await repository.findAllOrdered({ model: "H100" });

      expect(byVendorAndModel.map(row => [row.vendor, row.model])).toEqual([["nvidia", "H100"]]);
      expect(byModel.map(row => [row.vendor, row.model])).toEqual([
        ["amd", "h100"],
        ["nvidia", "H100"]
      ]);
    });
  });

  function aRow(overrides: Partial<GpuMarketPriceInsert>): GpuMarketPriceInsert {
    return {
      vendor: "nvidia",
      model: "h100",
      ram: "80Gi",
      interface: "sxm",
      area: null,
      source: "bid",
      lowUsdPerGpuHour: 1.5,
      medianUsdPerGpuHour: 2,
      highUsdPerGpuHour: 2.5,
      sampleCount: 12,
      providerCount: 4,
      newestSampleAt: new Date("2026-11-05T00:00:00.000Z"),
      windowDays: 30,
      computedAt: COMPUTED_AT,
      ...overrides
    };
  }

  function setup() {
    return { repository: container.resolve(GpuMarketPriceRepository) };
  }
});
