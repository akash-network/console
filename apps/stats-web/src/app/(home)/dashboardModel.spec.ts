import { describe, expect, it } from "vitest";

import { HERO_METRICS, microToUnit, toCapacityRows, toGpuRows, toGpuSummary, toMessageLabel } from "./dashboardModel";

import type { GpuModelPrice, NetworkCapacity } from "@/types";

describe("dashboardModel", () => {
  describe("HERO_METRICS", () => {
    it.each([
      ["dailyUsdSpent", 46180.4, "$46,180", 46180.4, "$46.2K"],
      ["activeLeases", 3924, "3,924", 12840, "12.8K"],
      ["activeGpus", 1046, "1,046", 1046, "1,046"],
      ["dailyLeases", 1418, "1,418", 25000, "25.0K"]
    ])("formats %s values and axis labels", (key, value, formattedValue, axisValue, formattedAxis) => {
      const metric = HERO_METRICS.find(candidate => candidate.key === key)!;

      expect(metric.formatValue(value)).toBe(formattedValue);
      expect(metric.formatAxisValue(axisValue)).toBe(formattedAxis);
    });

    it("scales daily spend from micro usd", () => {
      expect(HERO_METRICS[0].scale?.(8_250_000_000)).toBe(8250);
    });
  });

  describe(microToUnit.name, () => {
    it("divides by a million", () => {
      expect(microToUnit(2_500_000)).toBe(2.5);
    });
  });

  describe(toGpuRows.name, () => {
    it("lists the models with the most gpus first, up to the limit", () => {
      const rows = toGpuRows([gpu({ model: "t4", total: 10 }), gpu({ model: "h100", total: 486 }), gpu({ model: "a100", total: 200 })], 2);

      expect(rows.map(row => row.model)).toEqual(["h100", "a100"]);
    });

    it("maps availability, memory and prices", () => {
      const [row] = toGpuRows([gpu({ model: "h100", ram: "80Gi", available: 132, total: 486, price: { min: 1.45, weightedAverage: 2.42, max: 4.1 } })], 8);

      expect(row).toEqual({
        key: "nvidia-h100-80Gi-SXM5",
        model: "h100",
        ram: "80GB",
        availability: "132 / 486",
        availablePercent: 27,
        isScarce: false,
        minPrice: "$1.45",
        averagePrice: "$2.42",
        maxPrice: "$4.10"
      });
    });

    it("flags a model with under 15% of its gpus available as scarce", () => {
      const [scarce, plenty] = toGpuRows([gpu({ model: "a", available: 14, total: 100 }), gpu({ model: "b", available: 15, total: 99 })], 8);

      expect(scarce.isScarce).toBe(true);
      expect(plenty.isScarce).toBe(false);
    });

    it("treats a model without gpus as fully used", () => {
      const [row] = toGpuRows([gpu({ available: 0, total: 0 })], 8);

      expect(row.availablePercent).toBe(0);
      expect(row.isScarce).toBe(true);
    });

    it("shows dashes for a model without prices", () => {
      const [row] = toGpuRows([{ ...gpu({}), price: null }], 8);

      expect([row.minPrice, row.averagePrice, row.maxPrice]).toEqual(["—", "—", "—"]);
    });

    it("does not reorder the given models", () => {
      const models = [gpu({ model: "small", total: 1 }), gpu({ model: "big", total: 2 })];

      toGpuRows(models, 8);

      expect(models.map(model => model.model)).toEqual(["small", "big"]);
    });
  });

  describe(toCapacityRows.name, () => {
    it("compares what is leased with the total of each resource", () => {
      expect(toCapacityRows(capacity())).toEqual([
        { label: "GPU", active: "179", total: "396", percent: (179 / 396) * 100 },
        { label: "CPU", active: "2,520 vCPU", total: "14.4K vCPU", percent: (2520 / 14390) * 100 },
        { label: "Memory", active: "16.0 TB", total: "81.9 TB", percent: (16.01e12 / 81.9e12) * 100 },
        { label: "Storage", active: "48.5 TB", total: "612 TB", percent: (48.45e12 / 612.39e12) * 100 }
      ]);
    });

    it("caps a row at 100%", () => {
      expect(toCapacityRows(capacity({ activeGPU: 500, totalGPU: 400 }))[0].percent).toBe(100);
    });

    it("shows an empty row for a resource without capacity", () => {
      expect(toCapacityRows(capacity({ activeGPU: 0, totalGPU: 0 }))[0].percent).toBe(0);
    });
  });

  describe(toGpuSummary.name, () => {
    it("tells how much of the gpu capacity is leased and how much is free", () => {
      expect(toGpuSummary(capacity())).toBe("45% utilized · 217 available now");
    });

    it("reads 0% without gpus", () => {
      expect(toGpuSummary(capacity({ activeGPU: 0, totalGPU: 0 }))).toBe("0% utilized · 0 available now");
    });
  });

  describe(toMessageLabel.name, () => {
    it("names the first message without its Msg prefix", () => {
      expect(toMessageLabel({ messages: [message("/akash.market.v1beta5.MsgCreateBid"), message("/cosmos.bank.v1beta1.MsgSend")] })).toBe("CreateBid");
    });

    it("names a received transfer", () => {
      expect(toMessageLabel({ messages: [{ ...message("/cosmos.bank.v1beta1.MsgSend"), isReceiver: true }] })).toBe("Receive");
    });

    it("shows a dash without messages", () => {
      expect(toMessageLabel({ messages: [] })).toBe("—");
    });

    it("shows a dash for an empty type", () => {
      expect(toMessageLabel({ messages: [message("")] })).toBe("—");
    });

    function message(type: string) {
      return { id: type, type };
    }
  });

  function gpu(input: {
    model?: string;
    ram?: string;
    available?: number;
    total?: number;
    price?: { min: number; weightedAverage: number; max: number };
  }): GpuModelPrice {
    const price = input.price ?? { min: 1, weightedAverage: 2, max: 3 };

    return {
      vendor: "nvidia",
      model: input.model ?? "h100",
      ram: input.ram ?? "80Gi",
      interface: "SXM5",
      availability: { available: input.available ?? 1, total: input.total ?? 2 },
      providerAvailability: { available: 1, total: 1 },
      price: { currency: "USD", avg: price.weightedAverage, med: price.weightedAverage, ...price }
    };
  }

  function capacity(overrides: Partial<NetworkCapacity> = {}): NetworkCapacity {
    return {
      activeProviderCount: 51,
      activeCPU: 2_520_000,
      activeGPU: 179,
      activeMemory: 16.01e12,
      activeStorage: 48.45e12,
      pendingCPU: 0,
      pendingGPU: 0,
      pendingMemory: 0,
      pendingStorage: 0,
      availableCPU: 0,
      availableGPU: 0,
      availableMemory: 0,
      availableStorage: 0,
      totalCPU: 14_390_000,
      totalGPU: 396,
      totalMemory: 81.9e12,
      totalStorage: 612.39e12,
      ...overrides
    };
  }
});
