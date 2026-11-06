import { MsgCreateBid as MsgCreateBidV5 } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import type { Day } from "@akashnetwork/database/dbSchemas/base";
import { container } from "tsyringe";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Registry } from "@src/billing/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import type { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import type { CreateLogger } from "@src/core";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { GpuLeasePrice, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import type { GpuConfig } from "@src/gpu/config/env.config";
import type { DayRepository } from "@src/gpu/repositories/day.repository";
import type { GpuMarketPriceInsert, GpuMarketPriceRepository } from "@src/gpu/repositories/gpu-market-price/gpu-market-price.repository";
import type { ProviderRepository } from "@src/provider/repositories/provider/provider.repository";
import { GpuMarketPriceService } from "./gpu-market-price.service";

const PRICING_BOT = "akash1pricingbot";
const NOW = new Date("2026-11-06T12:00:00Z");
const DAY_ID = "day-1";
const H100 = { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "sxm" };

describe(GpuMarketPriceService.name, () => {
  describe("refresh", () => {
    it("stores a bid range across every region and one per region area", async () => {
      const { service, gpuMarketPriceRepository, providerRepository } = setup({
        deployments: [
          aDeployment({
            bids: [aBid({ provider: "p1", usdPerHour: 1.2 }), aBid({ provider: "p2", usdPerHour: 1.8 }), aBid({ provider: "p3", usdPerHour: 2.4 })]
          })
        ],
        regions: { p1: "na-us-west", p2: "na-us-southeast", p3: "eu-west" }
      });

      await service.refresh({ now: NOW });

      expect(providerRepository.findLocationRegions).toHaveBeenCalledWith(["p1", "p2", "p3"]);
      expect(storedRows(gpuMarketPriceRepository)).toEqual([
        expect.objectContaining({
          ...H100,
          area: null,
          source: "bid",
          medianUsdPerGpuHour: 1.8,
          sampleCount: 3,
          providerCount: 3,
          windowDays: 30,
          computedAt: NOW
        }),
        expect.objectContaining({ ...H100, area: "us", source: "bid", lowUsdPerGpuHour: 1.26, highUsdPerGpuHour: 1.74, sampleCount: 2, providerCount: 2 }),
        expect.objectContaining({ ...H100, area: "eu", source: "bid", medianUsdPerGpuHour: 2.4, sampleCount: 1, providerCount: 1 })
      ]);
    });

    it("keeps only the region-wide row for providers without a known area", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [aDeployment({ bids: [aBid({ provider: "p1" }), aBid({ provider: "p2" })] })],
        regions: { p1: "af-west" }
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository).map(row => row.area)).toEqual([null]);
    });

    it("keeps each provider's lowest bid per day", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [
          aDeployment({
            bids: [
              aBid({ provider: "p1", usdPerHour: 3, datetime: new Date("2026-11-05T01:00:00Z") }),
              aBid({ provider: "p1", usdPerHour: 2.4, datetime: new Date("2026-11-05T20:00:00Z") }),
              aBid({ provider: "p1", usdPerHour: 1.2, datetime: new Date("2026-11-04T20:00:00Z") })
            ]
          })
        ]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([
        expect.objectContaining({ lowUsdPerGpuHour: 1.32, highUsdPerGpuHour: 2.28, sampleCount: 2, newestSampleAt: new Date("2026-11-05T20:00:00Z") })
      ]);
    });

    it("lets the pricing bot's own price win its day over cheaper tenant bids", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [
          aDeployment({ id: "bot", owner: PRICING_BOT, bids: [aBid({ provider: "p1", usdPerHour: 2.4, cpu: 100 })] }),
          aDeployment({ id: "tenant", bids: [aBid({ provider: "p1", usdPerHour: 1.2 })] })
        ]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([expect.objectContaining({ medianUsdPerGpuHour: 2.4, sampleCount: 1 })]);
    });

    it("ignores the pricing bot's bids on orders other than its tiny pricing order", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [aDeployment({ owner: PRICING_BOT, bids: [aBid({ provider: "p1", cpu: 4000 })] })]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([]);
    });

    it("prices a bid per gpu across its units", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [aDeployment({ bids: [aBid({ provider: "p1", usdPerHour: 2.4, gpuUnits: 4 })] })]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([expect.objectContaining({ medianUsdPerGpuHour: 0.6 })]);
    });

    it("converts uakt bids at that day's AKT price and skips days without one", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [
          aDeployment({
            bids: [
              aBid({ provider: "p1", denom: "uakt", amount: "2000", dayId: DAY_ID }),
              aBid({ provider: "p2", denom: "uakt", amount: "2000", dayId: "day-without-price" })
            ]
          })
        ],
        days: [{ id: DAY_ID, aktPrice: 2 }, { id: "day-without-price" }]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([expect.objectContaining({ medianUsdPerGpuHour: 2.4, providerCount: 1 })]);
    });

    it("skips bids naming several gpu models, no model or a denom that doesn't convert", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [
          aDeployment({
            bids: [
              aBid({ provider: "p1", gpuAttributes: [gpuAttribute(H100), gpuAttribute({ ...H100, model: "a100" })] }),
              aBid({ provider: "p2", gpuAttributes: [{ key: "vendor/nvidia", value: "true" }] }),
              aBid({ provider: "p3", gpuAttributes: [] }),
              aBid({ provider: "p4", gpuUnits: 0 }),
              aBid({ provider: "p5", denom: "ibc/12AB" })
            ]
          })
        ]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([]);
    });

    it("keeps ram and interface empty when a bid's gpu attribute doesn't name them", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [aDeployment({ bids: [aBid({ provider: "p1", gpuAttributes: [{ key: "vendor/nvidia/model/rtx4090", value: "true" }] })] })]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([expect.objectContaining({ vendor: "nvidia", model: "rtx4090", ram: null, interface: null })]);
    });

    it("keeps gpu variants apart", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [
          aDeployment({
            bids: [
              aBid({ provider: "p1", gpuAttributes: [gpuAttribute(H100)] }),
              aBid({ provider: "p1", gpuAttributes: [gpuAttribute({ ...H100, interface: "pcie" })] })
            ]
          })
        ]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository).map(row => row.interface)).toEqual(["sxm", "pcie"]);
    });

    it("prices a lease per gpu with the model of the bid it accepted", async () => {
      const deployment = aDeployment({ id: "d1", bids: [aBid({ provider: "p1", gseq: 2, oseq: 1, usdPerHour: 9 })] });
      const { service, gpuMarketPriceRepository, leaseRepository } = setup({
        deployments: [deployment],
        leases: [aLease({ deploymentId: "d1", providerAddress: "p1", gseq: 2, oseq: 1, usdPerHour: 4.8, gpuUnits: 2 })]
      });

      await service.refresh({ now: NOW });

      expect(leaseRepository.findGpuLeasePricesOfDeployments).toHaveBeenCalledWith(["d1"]);
      expect(storedRows(gpuMarketPriceRepository)).toContainEqual(
        expect.objectContaining({
          ...H100,
          area: null,
          source: "lease",
          medianUsdPerGpuHour: 2.4,
          sampleCount: 1,
          newestSampleAt: new Date("2026-11-03T00:00:00Z")
        })
      );
    });

    it("skips leases whose accepted bid it can't find or whose price doesn't convert", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [aDeployment({ id: "d1", bids: [aBid({ provider: "p1", gseq: 1, oseq: 1 })] })],
        leases: [
          aLease({ deploymentId: "d1", providerAddress: "p2", gseq: 1, oseq: 1 }),
          aLease({ deploymentId: "d1", providerAddress: "p1", gseq: 2, oseq: 1 }),
          aLease({ deploymentId: "d1", providerAddress: "p1", gseq: 1, oseq: 2 }),
          aLease({ deploymentId: "d1", providerAddress: "p1", gseq: 1, oseq: 1, denom: "ibc/12AB" }),
          aLease({ deploymentId: "unknown", providerAddress: "p1", gseq: 1, oseq: 1 })
        ]
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository).map(row => row.source)).toEqual(["bid"]);
    });

    it("never looks up the pricing bot's leases", async () => {
      const { service, leaseRepository } = setup({
        deployments: [aDeployment({ id: "bot", owner: PRICING_BOT, bids: [aBid({ provider: "p1", cpu: 100 })] }), aDeployment({ id: "tenant", bids: [] })]
      });

      await service.refresh({ now: NOW });

      expect(leaseRepository.findGpuLeasePricesOfDeployments).toHaveBeenCalledWith(["tenant"]);
    });

    it("withholds prices below the configured thresholds", async () => {
      const { service, gpuMarketPriceRepository } = setup({
        deployments: [aDeployment({ bids: [aBid({ provider: "p1" }), aBid({ provider: "p2" })] })],
        config: { GPU_MARKET_PRICE_MIN_PROVIDERS: 3 }
      });

      await service.refresh({ now: NOW });

      expect(storedRows(gpuMarketPriceRepository)).toEqual([expect.objectContaining({ medianUsdPerGpuHour: null, sampleCount: 2, providerCount: 2 })]);
    });

    it("reads blocks from the start of the configured window and AKT prices from two days before it", async () => {
      const { service, akashBlockRepository, dayRepository, deploymentRepository } = setup({ deployments: [], config: { GPU_MARKET_PRICE_WINDOW_DAYS: 7 } });

      await service.refresh({ now: NOW });

      expect(akashBlockRepository.getFirstBlockAfter).toHaveBeenCalledWith(new Date("2026-10-30T12:00:00Z"));
      expect(dayRepository.getDaysAfter).toHaveBeenCalledWith(new Date("2026-10-28T12:00:00Z"));
      expect(deploymentRepository.findAllWithGpuResources).toHaveBeenCalledWith({ minHeight: 1000 });
    });

    it("computes without replacing anything on a dry run", async () => {
      const { service, gpuMarketPriceRepository } = setup({ deployments: [aDeployment({ bids: [aBid({ provider: "p1" })] })] });

      const result = await service.refresh({ dryRun: true, now: NOW });

      expect(result).toEqual({ rowCount: 1 });
      expect(gpuMarketPriceRepository.replaceAll).not.toHaveBeenCalled();
    });

    it("logs how many rows and samples it computed", async () => {
      const { service, logger } = setup({ deployments: [aDeployment({ bids: [aBid({ provider: "p1" })] })] });

      await service.refresh({ now: NOW });

      expect(logger.info).toHaveBeenCalledWith({ event: "GPU_MARKET_PRICES_REFRESHED", dryRun: false, rowCount: 1, bidSamples: 1, leaseSamples: 0 });
    });

    it("throws when no block falls in the window", async () => {
      const { service, akashBlockRepository } = setup({ deployments: [] });
      akashBlockRepository.getFirstBlockAfter.mockResolvedValue(null);

      await expect(service.refresh({ now: NOW })).rejects.toThrow("No block found in the market price window");
    });
  });

  it("creates the logger with the service context", () => {
    const { createLogger } = setup({ deployments: [] });

    expect(createLogger).toHaveBeenCalledWith({ context: GpuMarketPriceService.name });
  });

  function setup(input: {
    deployments: ReturnType<typeof aDeployment>[];
    leases?: GpuLeasePrice[];
    regions?: Record<string, string>;
    days?: { id: string; aktPrice?: number }[];
    config?: Partial<GpuConfig>;
  }) {
    const deploymentRepository = mock<DeploymentRepository>();
    const leaseRepository = mock<LeaseRepository>();
    const providerRepository = mock<ProviderRepository>();
    const akashBlockRepository = mock<AkashBlockRepository>();
    const dayRepository = mock<DayRepository>();
    const gpuMarketPriceRepository = mock<GpuMarketPriceRepository>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const config: GpuConfig = {
      PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: 180,
      PRICING_BOT_ADDRESS: PRICING_BOT,
      GPU_MARKET_PRICE_WINDOW_DAYS: 30,
      GPU_MARKET_PRICE_MIN_PROVIDERS: 1,
      GPU_MARKET_PRICE_MIN_SAMPLES: 1,
      ...input.config
    };

    akashBlockRepository.getFirstBlockAfter.mockResolvedValue(mock<AkashBlock>({ height: 1000 }));
    dayRepository.getDaysAfter.mockResolvedValue((input.days ?? [{ id: DAY_ID, aktPrice: 2 }]).map(day => mock<Day>({ id: day.id, aktPrice: day.aktPrice })));
    deploymentRepository.findAllWithGpuResources.mockReturnValue(
      (async function* () {
        yield* input.deployments;
      })() as never
    );
    leaseRepository.findGpuLeasePricesOfDeployments.mockImplementation(async ids => (input.leases ?? []).filter(lease => ids.includes(lease.deploymentId)));
    providerRepository.findLocationRegions.mockResolvedValue(new Map(Object.entries(input.regions ?? {})));

    const typeRegistry = container.createChildContainer().resolve<Registry>(TYPE_REGISTRY);
    const service = new GpuMarketPriceService(
      deploymentRepository,
      leaseRepository,
      providerRepository,
      akashBlockRepository,
      dayRepository,
      gpuMarketPriceRepository,
      config,
      typeRegistry,
      createLogger
    );

    return {
      service,
      deploymentRepository,
      leaseRepository,
      providerRepository,
      akashBlockRepository,
      dayRepository,
      gpuMarketPriceRepository,
      logger,
      createLogger
    };
  }

  function storedRows(repository: ReturnType<typeof mock<GpuMarketPriceRepository>>): GpuMarketPriceInsert[] {
    expect(repository.replaceAll).toHaveBeenCalledTimes(1);
    return repository.replaceAll.mock.calls[0][0];
  }

  function aDeployment(input: { id?: string; owner?: string; bids: ReturnType<typeof aBid>[] }) {
    return { id: input.id ?? "deployment", owner: input.owner ?? "akash1tenant", relatedMessages: input.bids };
  }

  function gpuAttribute(gpu: { vendor: string; model: string; ram: string; interface: string }) {
    return { key: `vendor/${gpu.vendor}/model/${gpu.model}/ram/${gpu.ram}/interface/${gpu.interface}`, value: "true" };
  }

  function aBid(input: {
    provider: string;
    usdPerHour?: number;
    denom?: string;
    amount?: string;
    gpuUnits?: number;
    cpu?: number;
    gseq?: number;
    oseq?: number;
    gpuAttributes?: { key: string; value: string }[];
    datetime?: Date;
    dayId?: string;
  }) {
    const bid = MsgCreateBidV5.fromPartial({
      id: { owner: "akash1tenant", dseq: 1, gseq: input.gseq ?? 1, oseq: input.oseq ?? 1, bseq: 0, provider: input.provider },
      price: { denom: input.denom ?? "uact", amount: input.amount ?? uactPerBlock(input.usdPerHour ?? 1.2) },
      resourcesOffer: [
        {
          resources: {
            id: 1,
            cpu: { units: { val: BigInt(input.cpu ?? 1000) }, attributes: [] },
            memory: { quantity: { val: BigInt(1024) }, attributes: [] },
            storage: [],
            gpu: { units: { val: BigInt(input.gpuUnits ?? 1) }, attributes: input.gpuAttributes ?? [gpuAttribute(H100)] },
            endpoints: []
          },
          count: 1
        }
      ]
    });

    return {
      type: "/akash.market.v1beta5.MsgCreateBid",
      data: MsgCreateBidV5.encode(bid).finish(),
      height: 1001,
      block: { dayId: input.dayId ?? DAY_ID, datetime: input.datetime ?? new Date("2026-11-02T00:00:00Z") },
      transaction: { hash: "hash" }
    };
  }

  function aLease(input: Partial<GpuLeasePrice> & { usdPerHour?: number }): GpuLeasePrice {
    const { usdPerHour, ...overrides } = input;
    return {
      deploymentId: "deployment",
      providerAddress: "p1",
      gseq: 1,
      oseq: 1,
      price: Number(uactPerBlock(usdPerHour ?? 1.2)),
      denom: "uact",
      gpuUnits: 1,
      dayId: DAY_ID,
      createdAt: new Date("2026-11-03T00:00:00Z"),
      ...overrides
    };
  }

  function uactPerBlock(usdPerHour: number): string {
    return String(Math.round((usdPerHour * 1_000_000) / 600));
  }
});
