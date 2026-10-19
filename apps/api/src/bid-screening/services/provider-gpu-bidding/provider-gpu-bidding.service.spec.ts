import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { type BidScreeningRequest, BidScreeningRequestSchema } from "@src/bid-screening/http-schemas/bid-screening.schema";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { GpuBidCheckRepository, PricingBotCheckHistory } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { findRequestedGpuModels, ProviderGpuBiddingService } from "./provider-gpu-bidding.service";

const H100 = { vendor: "nvidia", model: "h100" };
const A100 = { vendor: "nvidia", model: "a100" };

describe(ProviderGpuBiddingService.name, () => {
  describe("addBidding", () => {
    it("reads the history of every listed provider for the requested models over the last 48 hours", async () => {
      vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-19T12:00:00Z") });
      try {
        const { service, gpuBidCheckRepository } = setup();

        await service.addBidding(aScreening("akash1first", "akash1second"), [H100, A100]);

        expect(gpuBidCheckRepository.findPricingBotHistory).toHaveBeenCalledWith({
          providers: ["akash1first", "akash1second"],
          models: [H100, A100],
          since: new Date("2026-10-17T12:00:00Z")
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("flags a provider listed on every check of the last 48 hours, at least 3, that bid on none", async () => {
      const { service } = setup({ history: [aHistory({ checks: 3, screenedChecks: 3 })] });

      expect(await service.addBidding(aScreening("akash1provider"), [H100])).toEqual(withBidding({ isNotBidding: true, lastCheckBidAt: null }));
    });

    it("does not flag a provider with fewer than 3 checks", async () => {
      const { service } = setup({ history: [aHistory({ checks: 2, screenedChecks: 2 })] });

      expect(await service.addBidding(aScreening("akash1provider"), [H100])).toEqual(withBidding({ isNotBidding: false, lastCheckBidAt: null }));
    });

    it("does not flag a provider some of the checks did not list", async () => {
      const { service } = setup({ history: [aHistory({ checks: 4, screenedChecks: 3 })] });

      expect(await service.addBidding(aScreening("akash1provider"), [H100])).toEqual(withBidding({ isNotBidding: false, lastCheckBidAt: null }));
    });

    it("does not flag a provider that bid on a check since", async () => {
      const lastBidAt = new Date("2026-10-19T06:01:30Z");
      const { service } = setup({ history: [aHistory({ checks: 8, screenedChecks: 8, bidSinceCutoff: true, lastBidAt })] });

      expect(await service.addBidding(aScreening("akash1provider"), [H100])).toEqual(
        withBidding({ isNotBidding: false, lastCheckBidAt: "2026-10-19T06:01:30.000Z" })
      );
    });

    it("does not flag a provider that bid on another of the requested models", async () => {
      const { service } = setup({
        history: [aHistory({ ...H100, checks: 3, screenedChecks: 3 }), aHistory({ ...A100, checks: 1, screenedChecks: 0, bidSinceCutoff: true })]
      });

      expect(await service.addBidding(aScreening("akash1provider"), [H100, A100])).toEqual(withBidding({ isNotBidding: false, lastCheckBidAt: null }));
    });

    it("flags a provider silent on one requested model and quiet on the other", async () => {
      const { service } = setup({
        history: [aHistory({ ...H100, checks: 3, screenedChecks: 3 }), aHistory({ ...A100, checks: 8, screenedChecks: 2 })]
      });

      expect(await service.addBidding(aScreening("akash1provider"), [H100, A100])).toEqual(withBidding({ isNotBidding: true, lastCheckBidAt: null }));
    });

    it("reports the latest bid across the requested models", async () => {
      const { service } = setup({
        history: [
          aHistory({ ...H100, lastBidAt: new Date("2026-10-01T00:00:00Z") }),
          aHistory({ ...A100, lastBidAt: new Date("2026-10-05T00:00:00Z") }),
          aHistory({ vendor: "nvidia", model: "l40s", lastBidAt: null })
        ]
      });

      expect(await service.addBidding(aScreening("akash1provider"), [H100, A100])).toEqual(
        withBidding({ isNotBidding: false, lastCheckBidAt: "2026-10-05T00:00:00.000Z" })
      );
    });

    it("gives each provider its own history and an unflagged one when it has none", async () => {
      const { service } = setup({ history: [aHistory({ provider: "akash1silent", checks: 3, screenedChecks: 3 })] });

      expect(await service.addBidding(aScreening("akash1unchecked", "akash1silent"), [H100])).toEqual({
        providers: [
          { owner: "akash1unchecked", isNotBidding: false, lastCheckBidAt: null },
          { owner: "akash1silent", isNotBidding: true, lastCheckBidAt: null }
        ]
      });
    });

    it("keeps every other field of the screening and of its providers", async () => {
      const { service } = setup();
      const screening = { providers: [{ owner: "akash1provider", hostUri: "https://provider:8443", incidents: [] }], cursor: "next" };

      expect(await service.addBidding(screening, [H100])).toEqual({
        providers: [{ owner: "akash1provider", hostUri: "https://provider:8443", incidents: [], isNotBidding: false, lastCheckBidAt: null }],
        cursor: "next"
      });
    });

    it("returns a body that is not a screening as it is", async () => {
      const { service, gpuBidCheckRepository, logger } = setup();
      const body = { providers: [{ hostUri: "https://provider:8443" }] };

      expect(await service.addBidding(body, [H100])).toBe(body);
      expect(gpuBidCheckRepository.findPricingBotHistory).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("reads the history for up to 10 requested models", async () => {
      const { service, gpuBidCheckRepository } = setup();
      const models = Array.from({ length: 10 }, (_, index) => ({ vendor: "nvidia", model: `model${index}` }));

      await service.addBidding(aScreening("akash1provider"), models);

      expect(gpuBidCheckRepository.findPricingBotHistory).toHaveBeenCalledWith(expect.objectContaining({ models }));
    });

    it("returns the screening as it is when it asks for more than 10 models", async () => {
      const { service, gpuBidCheckRepository } = setup();
      const screening = aScreening("akash1provider");
      const models = Array.from({ length: 11 }, (_, index) => ({ vendor: "nvidia", model: `model${index}` }));

      expect(await service.addBidding(screening, models)).toBe(screening);
      expect(gpuBidCheckRepository.findPricingBotHistory).not.toHaveBeenCalled();
    });

    it("returns the screening as it is when the history cannot be read", async () => {
      const { service, gpuBidCheckRepository, logger } = setup();
      gpuBidCheckRepository.findPricingBotHistory.mockRejectedValue(new Error("database unavailable"));
      const screening = aScreening("akash1provider");

      expect(await service.addBidding(screening, [H100])).toBe(screening);
      expect(logger.warn).toHaveBeenCalledWith({ event: "PROVIDER_GPU_BIDDING_UNAVAILABLE", error: new Error("database unavailable") });
    });
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: ProviderGpuBiddingService.name });
  });

  function aScreening(...owners: string[]) {
    return { providers: owners.map(owner => ({ owner })) };
  }

  function withBidding(bidding: { isNotBidding: boolean; lastCheckBidAt: string | null }) {
    return { providers: [{ owner: "akash1provider", ...bidding }] };
  }

  function aHistory(overrides: Partial<PricingBotCheckHistory> = {}): PricingBotCheckHistory {
    return { provider: "akash1provider", ...H100, checks: 0, screenedChecks: 0, bidSinceCutoff: false, lastBidAt: null, ...overrides };
  }

  function setup(input: { history?: PricingBotCheckHistory[] } = {}) {
    const gpuBidCheckRepository = mock<GpuBidCheckRepository>();
    gpuBidCheckRepository.findPricingBotHistory.mockResolvedValue(input.history ?? []);

    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new ProviderGpuBiddingService(gpuBidCheckRepository, createLogger);

    return { service, gpuBidCheckRepository, logger, createLogger };
  }
});

describe(findRequestedGpuModels.name, () => {
  it("reads the vendor and model of every gpu attribute, whatever follows the model", () => {
    const request = aRequest([
      { gpuUnits: 1, gpuKeys: ["vendor/nvidia/model/h100/ram/80Gi", "vendor/nvidia/model/a100", "vendor/amd/model/mi300x/interface/sxm"] }
    ]);

    expect(findRequestedGpuModels(request)).toEqual([H100, A100, { vendor: "amd", model: "mi300x" }]);
  });

  it("reads a model asked for by several resources once", () => {
    const request = aRequest([
      { gpuUnits: 1, gpuKeys: ["vendor/nvidia/model/h100/ram/80Gi"] },
      { gpuUnits: 2, gpuKeys: ["vendor/nvidia/model/h100"] }
    ]);

    expect(findRequestedGpuModels(request)).toEqual([H100]);
  });

  it("reads no model from a request for any model of a vendor", () => {
    expect(findRequestedGpuModels(aRequest([{ gpuUnits: 1, gpuKeys: ["vendor/nvidia/model/*", "vendor/nvidia"] }]))).toEqual([]);
  });

  it("reads no model from a resource that asks for no gpu", () => {
    expect(findRequestedGpuModels(aRequest([{ gpuUnits: 0, gpuKeys: ["vendor/nvidia/model/h100"] }, { gpuUnits: 1 }]))).toEqual([]);
  });

  it("reads no model from an attribute that does not ask for it, as provider inventory screens", () => {
    const request = aRequest([
      {
        gpuUnits: 1,
        gpuAttributes: [
          { key: "vendor/nvidia/model/h100", value: "false" },
          { key: "vendor/nvidia/model/a100", value: "true" }
        ]
      }
    ]);

    expect(findRequestedGpuModels(request)).toEqual([A100]);
  });

  it.each([["vendor/nvidia/model/h100*"], ["vendor/nvidia"]])("reads no model when a gpu also takes models no check covers: %s", openKey => {
    expect(findRequestedGpuModels(aRequest([{ gpuUnits: 1, gpuKeys: [openKey, "vendor/nvidia/model/a100"] }]))).toEqual([]);
  });

  it("reads the models of a gpu pinned to them while another gpu of the request takes any model", () => {
    const request = aRequest([
      { gpuUnits: 1, gpuKeys: ["vendor/nvidia/model/a100"] },
      { gpuUnits: 1, gpuKeys: ["vendor/nvidia/model/h100*"] },
      { gpuUnits: 1 }
    ]);

    expect(findRequestedGpuModels(request)).toEqual([A100]);
  });

  function aRequest(resources: Array<{ gpuUnits: number; gpuKeys?: string[]; gpuAttributes?: Array<{ key: string; value: string }> }>): BidScreeningRequest {
    return BidScreeningRequestSchema.parse({
      timezone: "UTC",
      resources: resources.map(({ gpuUnits, gpuKeys, gpuAttributes }, index) => ({
        resource: {
          id: index + 1,
          cpu: { units: { val: "1000" } },
          memory: { quantity: { val: "1073741824" } },
          gpu: { units: { val: String(gpuUnits) }, attributes: gpuAttributes ?? gpuKeys?.map(key => ({ key, value: "true" })) },
          storage: []
        },
        count: 1,
        price: { denom: "uact", amount: "1000" }
      }))
    });
  }
});
