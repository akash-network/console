import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { GpuPriceService } from "@src/gpu/services/gpu-price/gpu-price.service";
import type { GpuBidType, GpuPriceModel, GpuProviderType } from "@src/gpu/types/gpu.type";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { GpuSupplyService } from "./gpu-supply.service";

describe(GpuSupplyService.name, () => {
  describe("listSupply", () => {
    it("lists each gpu variant with the providers that bid on it, their region and best bid", async () => {
      const west = aProvider({ owner: "akash1west", allocatable: 8, allocated: 3 });
      const { service, providerRepository } = setup({
        models: [
          aModel({
            model: "h100",
            availability: { total: 16, available: 9 },
            providersWithBestBid: [{ provider: west, bestBid: aBid({ hourlyPrice: 2.45, datetime: new Date("2026-11-05T10:00:00Z") }) }]
          })
        ],
        regions: { akash1west: "na-us-west" }
      });

      const supply = await service.listSupply({});

      expect(providerRepository.findLocationRegions).toHaveBeenCalledWith(["akash1west"]);
      expect(supply).toEqual([
        {
          vendor: "nvidia",
          model: "h100",
          ram: "80Gi",
          interface: "sxm",
          allocatable: 16,
          available: 9,
          providers: [
            {
              owner: "akash1west",
              hostUri: "https://akash1west.example",
              region: "na-us-west",
              area: "us",
              allocatable: 8,
              available: 5,
              bestBid: { usdPerGpuHour: 2.45, placedAt: "2026-11-05T10:00:00.000Z" }
            }
          ]
        }
      ]);
    });

    it("keeps variants nobody bid on, with no providers", async () => {
      const { service } = setup({ models: [aModel({ model: "rtx4090", providersWithBestBid: undefined })] });

      const supply = await service.listSupply({});

      expect(supply).toEqual([expect.objectContaining({ model: "rtx4090", providers: [] })]);
    });

    it("leaves region and area empty for providers without a location-region", async () => {
      const { service } = setup({ models: [aModel({ providersWithBestBid: [{ provider: aProvider({ owner: "akash1nowhere" }), bestBid: aBid({}) }] })] });

      const [variant] = await service.listSupply({});

      expect(variant.providers[0]).toMatchObject({ region: null, area: null });
    });

    it("reads a cached best bid time stored as a string", async () => {
      const bestBid = aBid({});
      Object.assign(bestBid, { datetime: "2026-11-04T08:30:00.000Z" });
      const { service } = setup({ models: [aModel({ providersWithBestBid: [{ provider: aProvider({}), bestBid }] })] });

      const [variant] = await service.listSupply({});

      expect(variant.providers[0].bestBid.placedAt).toBe("2026-11-04T08:30:00.000Z");
    });

    it("filters by vendor and model regardless of case", async () => {
      const { service, gpuPriceService } = setup({
        models: [aModel({ vendor: "nvidia", model: "h100" }), aModel({ vendor: "nvidia", model: "a100" }), aModel({ vendor: "amd", model: "h100" })]
      });

      const supply = await service.listSupply({ vendor: "NVIDIA", model: "H100" });

      expect(gpuPriceService.getGpuPrices).toHaveBeenCalledWith(true);
      expect(supply.map(variant => [variant.vendor, variant.model])).toEqual([["nvidia", "h100"]]);
    });

    it("looks up each bidding provider's region once", async () => {
      const provider = aProvider({ owner: "akash1shared" });
      const { service, providerRepository } = setup({
        models: [
          aModel({ model: "h100", providersWithBestBid: [{ provider, bestBid: aBid({}) }] }),
          aModel({ model: "a100", providersWithBestBid: [{ provider, bestBid: aBid({}) }] })
        ]
      });

      await service.listSupply({});

      expect(providerRepository.findLocationRegions).toHaveBeenCalledWith(["akash1shared"]);
    });
  });

  function setup(input: { models: GpuPriceModel[]; regions?: Record<string, string> }) {
    const gpuPriceService = mock<GpuPriceService>();
    const providerRepository = mock<ProviderRepository>();
    gpuPriceService.getGpuPrices.mockResolvedValue({ availability: { total: 0, available: 0 }, models: input.models });
    providerRepository.findLocationRegions.mockResolvedValue(new Map(Object.entries(input.regions ?? {})));

    return { service: new GpuSupplyService(gpuPriceService, providerRepository), gpuPriceService, providerRepository };
  }

  function aProvider(overrides: Partial<GpuProviderType>): GpuProviderType {
    const owner = overrides.owner ?? "akash1provider";
    return { owner, hostUri: `https://${owner}.example`, allocatable: 4, allocated: 1, ...overrides };
  }

  function aBid(overrides: Partial<GpuBidType>): GpuBidType {
    return mock<GpuBidType>({ hourlyPrice: 1.5, datetime: new Date("2026-11-01T00:00:00Z"), ...overrides });
  }

  function aModel(overrides: Partial<GpuPriceModel>): GpuPriceModel {
    return {
      vendor: "nvidia",
      model: "h100",
      ram: "80Gi",
      interface: "sxm",
      availability: { total: 8, available: 4 },
      providerAvailability: { total: 1, available: 1 },
      price: null,
      priceUakt: null,
      providersWithBestBid: [],
      ...overrides
    };
  }
});
