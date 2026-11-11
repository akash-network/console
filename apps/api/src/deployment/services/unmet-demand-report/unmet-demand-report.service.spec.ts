import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { UnmetDemandEventRepository } from "@src/deployment/repositories/unmet-demand-event/unmet-demand-event.repository";
import type { GpuMarketPriceOutput, GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import type { GpuSupplyService } from "@src/gpu/services/gpu-supply/gpu-supply.service";
import type { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { UnmetDemandReportService } from "./unmet-demand-report.service";

const NOW = new Date("2026-11-06T12:00:00Z");

describe(UnmetDemandReportService.name, () => {
  it("reads the window's unmet demand and requests since the asked number of days, with live supply and market prices", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: NOW });
    try {
      const { service, unmetDemandEventRepository, hardwareRequestRepository, gpuSupplyService, gpuMarketPriceRepository } = setup();
      unmetDemandEventRepository.summarizeSince.mockResolvedValue([
        { vendor: "nvidia", model: "h100", regionArea: null, noFit: 2, missingGpu: 0, zeroBid: 1, gpusAsked: 16 }
      ]);
      hardwareRequestRepository.findRequestedGpusSince.mockResolvedValue([{ model: "H100", region: null }]);
      gpuSupplyService.listSupply.mockResolvedValue([
        { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "sxm", allocatable: 8, available: 2, providers: [] }
      ]);
      gpuMarketPriceRepository.findAllOrdered.mockResolvedValue([
        mock<GpuMarketPriceOutput>({ vendor: "nvidia", model: "h100", area: null, source: "bid", medianUsdPerGpuHour: 2, sampleCount: 9 })
      ]);

      const report = await service.report({ days: 7 });

      const since = new Date("2026-10-30T12:00:00Z");
      expect(unmetDemandEventRepository.summarizeSince).toHaveBeenCalledWith(since);
      expect(hardwareRequestRepository.unscoped).toHaveBeenCalledWith("platform-statistics");
      expect(hardwareRequestRepository.findRequestedGpusSince).toHaveBeenCalledWith(since);
      expect(gpuSupplyService.listSupply).toHaveBeenCalledWith({});
      expect(report).toEqual({
        since: since.toISOString(),
        data: [
          expect.objectContaining({
            model: "h100",
            totalUnmet: 3,
            hardwareRequests: 1,
            supply: { allocatable: 8, available: 2, biddingProviders: 0, biddingProvidersInArea: null },
            marketMedianUsdPerGpuHour: { allRegions: { bid: 2, lease: null }, area: null }
          })
        ]
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("still reports, without supply, when live supply cannot be read", async () => {
    const { service, unmetDemandEventRepository, gpuSupplyService, logger } = setup();
    unmetDemandEventRepository.summarizeSince.mockResolvedValue([
      { vendor: "nvidia", model: "h100", regionArea: null, noFit: 1, missingGpu: 0, zeroBid: 0, gpusAsked: 1 }
    ]);
    const error = new Error("No block found");
    gpuSupplyService.listSupply.mockRejectedValue(error);

    const report = await service.report({ days: 30 });

    expect(report.data).toEqual([expect.objectContaining({ model: "h100", supply: null })]);
    expect(logger.warn).toHaveBeenCalledWith({ event: "UNMET_DEMAND_SUPPLY_UNAVAILABLE", error });
  });

  it("logs under its own name", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: UnmetDemandReportService.name });
  });

  function setup() {
    const unmetDemandEventRepository = mock<UnmetDemandEventRepository>();
    unmetDemandEventRepository.summarizeSince.mockResolvedValue([]);
    const hardwareRequestRepository = mock<HardwareRequestRepository>();
    hardwareRequestRepository.unscoped.mockReturnValue(hardwareRequestRepository);
    hardwareRequestRepository.findRequestedGpusSince.mockResolvedValue([]);
    const gpuSupplyService = mock<GpuSupplyService>();
    gpuSupplyService.listSupply.mockResolvedValue([]);
    const gpuMarketPriceRepository = mock<GpuMarketPriceRepository>();
    gpuMarketPriceRepository.findAllOrdered.mockResolvedValue([]);
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new UnmetDemandReportService(
      unmetDemandEventRepository,
      hardwareRequestRepository,
      gpuSupplyService,
      gpuMarketPriceRepository,
      createLogger
    );

    return { service, unmetDemandEventRepository, hardwareRequestRepository, gpuSupplyService, gpuMarketPriceRepository, logger, createLogger };
  }
});
