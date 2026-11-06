import { describe, expect, it } from "vitest";

import type { RequestedHardware } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { buildUnmetDemandReport, type GpuVariantSupply, type MarketPrice, type UnmetDemandSummary } from "./unmet-demand-report";

describe(buildUnmetDemandReport.name, () => {
  it("totals the unmet kinds of each row and lists the most unmet first, then the most gpus asked, then by name", () => {
    const rows = build({
      summaries: [
        aSummary({ model: "a100", regionArea: "eu", noFit: 1, gpusAsked: 1 }),
        aSummary({ vendor: null, model: null, noFit: 1, gpusAsked: 1 }),
        aSummary({ vendor: "nvidia", model: null, noFit: 1, gpusAsked: 1 }),
        aSummary({ model: "h100", noFit: 1, missingGpu: 2, zeroBid: 3 }),
        aSummary({ model: "b200", zeroBid: 1, gpusAsked: 8 }),
        aSummary({ model: "a100", noFit: 1, gpusAsked: 1 })
      ]
    });

    expect(rows.map(({ vendor, model, regionArea, totalUnmet }) => [vendor, model, regionArea, totalUnmet])).toEqual([
      ["nvidia", "h100", null, 6],
      ["nvidia", "b200", null, 1],
      [null, null, null, 1],
      ["nvidia", null, null, 1],
      ["nvidia", "a100", null, 1],
      ["nvidia", "a100", "eu", 1]
    ]);
  });

  describe("hardware requests", () => {
    it("counts the requests naming the model in free text", () => {
      const [row] = build({
        summaries: [aSummary({ vendor: "nvidia", model: "h100" })],
        hardwareRequests: [aRequest("H100"), aRequest("NVIDIA H-100"), aRequest("h100 80GB"), aRequest("a100"), aRequest("b200")]
      });

      expect(row.hardwareRequests).toBe(2);
    });

    it.each([
      { region: { mode: "any", areas: ["eu"] }, counted: 1 },
      { region: null, counted: 1 },
      { region: { mode: "only", areas: ["us", "eu"] }, counted: 1 },
      { region: { mode: "only", areas: ["us"] }, counted: 0 },
      { region: { mode: "except", areas: ["us"] }, counted: 1 },
      { region: { mode: "except", areas: ["eu"] }, counted: 0 }
    ] satisfies Array<{ region: RequestedHardware["region"]; counted: number }>)(
      "counts a request with region $region toward an eu row $counted time(s)",
      ({ region, counted }) => {
        const [row] = build({ summaries: [aSummary({ model: "h100", regionArea: "eu" })], hardwareRequests: [aRequest("h100", region)] });

        expect(row.hardwareRequests).toBe(counted);
      }
    );

    it("counts every request for the model on a row with no area", () => {
      const [row] = build({
        summaries: [aSummary({ model: "h100" })],
        hardwareRequests: [aRequest("h100", { mode: "only", areas: ["us"] }), aRequest("h100", { mode: "except", areas: ["eu"] })]
      });

      expect(row.hardwareRequests).toBe(2);
    });
  });

  describe("supply", () => {
    it("adds up the model's variants and counts each provider that bid once, in all regions and in the row's area", () => {
      const [row] = build({
        summaries: [aSummary({ vendor: "nvidia", model: "h100", regionArea: "eu" })],
        supply: [
          aVariant({
            model: "H100",
            allocatable: 8,
            available: 2,
            providers: [aProvider("akash1a", "eu"), aProvider("akash1b", "us"), aProvider("akash1e", "us")]
          }),
          aVariant({ model: "h100", allocatable: 4, available: 4, providers: [aProvider("akash1a", "eu")] }),
          aVariant({ vendor: "amd", model: "h100", allocatable: 100, available: 100, providers: [aProvider("akash1c", "eu")] }),
          aVariant({ model: "a100", allocatable: 16, available: 16, providers: [aProvider("akash1d", "eu")] })
        ]
      });

      expect(row.supply).toEqual({ allocatable: 12, available: 6, biddingProviders: 3, biddingProvidersInArea: 1 });
    });

    it("reports no supply for a model nobody has, and no area count on a row with no area", () => {
      const [row] = build({ summaries: [aSummary({ model: "b200" })], supply: [aVariant({ model: "h100" })] });

      expect(row.supply).toEqual({ allocatable: 0, available: 0, biddingProviders: 0, biddingProvidersInArea: null });
    });

    it("leaves supply out when it could not be read", () => {
      const [row] = build({ summaries: [aSummary({ model: "h100" })], supply: null });

      expect(row.supply).toBeNull();
    });

    it("matches any vendor's variant of the model on a row with no vendor", () => {
      const [row] = build({ summaries: [aSummary({ vendor: null, model: "h100" })], supply: [aVariant({ vendor: "nvidia", model: "h100", allocatable: 3 })] });

      expect(row.supply).toEqual(expect.objectContaining({ allocatable: 3 }));
    });
  });

  describe("market medians", () => {
    it("takes, per source, the median of the most sampled variant across all regions and in the row's area", () => {
      const [row] = build({
        summaries: [aSummary({ vendor: "nvidia", model: "h100", regionArea: "eu" })],
        marketPrices: [
          aPrice({ area: null, source: "bid", medianUsdPerGpuHour: 9, sampleCount: 3 }),
          aPrice({ area: null, source: "bid", medianUsdPerGpuHour: 2, sampleCount: 30 }),
          aPrice({ area: null, source: "bid", medianUsdPerGpuHour: 7, sampleCount: 30 }),
          aPrice({ area: null, source: "lease", medianUsdPerGpuHour: null, sampleCount: 2 }),
          aPrice({ area: "eu", source: "bid", medianUsdPerGpuHour: 2.5, sampleCount: 5 }),
          aPrice({ area: "us", source: "lease", medianUsdPerGpuHour: 1.5, sampleCount: 50 }),
          aPrice({ model: "a100", area: "eu", source: "lease", medianUsdPerGpuHour: 1, sampleCount: 50 })
        ]
      });

      expect(row.marketMedianUsdPerGpuHour).toEqual({ allRegions: { bid: 2, lease: null }, area: { bid: 2.5, lease: null } });
    });

    it("has no area medians on a row with no area", () => {
      const [row] = build({
        summaries: [aSummary({ model: "h100" })],
        marketPrices: [aPrice({ area: null, source: "bid", medianUsdPerGpuHour: 2 }), aPrice({ area: null, source: "lease", medianUsdPerGpuHour: 1.7 })]
      });

      expect(row.marketMedianUsdPerGpuHour).toEqual({ allRegions: { bid: 2, lease: 1.7 }, area: null });
    });
  });

  it("carries no requests, supply or prices on a row open to any model", () => {
    const [row] = build({
      summaries: [aSummary({ vendor: "nvidia", model: null })],
      hardwareRequests: [aRequest("nvidia")],
      supply: [aVariant({})],
      marketPrices: [aPrice({})]
    });

    expect(row).toEqual(expect.objectContaining({ hardwareRequests: null, supply: null, marketMedianUsdPerGpuHour: null }));
  });

  function build(input: {
    summaries: UnmetDemandSummary[];
    hardwareRequests?: RequestedHardware[];
    supply?: GpuVariantSupply[] | null;
    marketPrices?: MarketPrice[];
  }) {
    return buildUnmetDemandReport({
      summaries: input.summaries,
      hardwareRequests: input.hardwareRequests ?? [],
      supply: input.supply === undefined ? [] : input.supply,
      marketPrices: input.marketPrices ?? []
    });
  }

  function aSummary(overrides: Partial<UnmetDemandSummary>): UnmetDemandSummary {
    return { vendor: "nvidia", model: "h100", regionArea: null, noFit: 0, missingGpu: 0, zeroBid: 0, gpusAsked: 0, ...overrides };
  }

  function aRequest(model: string, region: RequestedHardware["region"] = null): RequestedHardware {
    return { model, region };
  }

  function aVariant(overrides: Partial<GpuVariantSupply>): GpuVariantSupply {
    return { vendor: "nvidia", model: "h100", allocatable: 0, available: 0, providers: [], ...overrides };
  }

  function aProvider(owner: string, area: GpuVariantSupply["providers"][number]["area"]) {
    return { owner, area };
  }

  function aPrice(overrides: Partial<MarketPrice>): MarketPrice {
    return { vendor: "nvidia", model: "h100", area: null, source: "bid", medianUsdPerGpuHour: 2, sampleCount: 10, ...overrides };
  }
});
