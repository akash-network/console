import { MsgCreateBid as MsgCreateBidV4 } from "@akashnetwork/akash-api/akash/market/v1beta4";
import { MsgCreateBid as MsgCreateBidV5 } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import type { AkashBlock } from "@akashnetwork/database/dbSchemas/akash";
import type { Day } from "@akashnetwork/database/dbSchemas/base";
import { faker } from "@faker-js/faker";
import { subDays } from "date-fns";
import { container } from "tsyringe";
import { mock } from "vitest-mock-extended";

import type { Registry } from "@src/billing/providers/type-registry.provider";
import { TYPE_REGISTRY } from "@src/billing/providers/type-registry.provider";
import type { AkashBlockRepository } from "@src/block/repositories/akash-block/akash-block.repository";
import { cacheEngine } from "@src/caching/helpers";
import type { LoggerService } from "@src/core";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type { GpuConfig } from "../../config/env.config";
import type { DayRepository } from "../../repositories/day.repository";
import type { GpuRepository } from "../../repositories/gpu.repository";
import type { GpuType } from "../../types/gpu.type";
import { GpuPriceService } from "./gpu-price.service";

describe(GpuPriceService.name, () => {
  beforeEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  afterEach(() => {
    cacheEngine.clearAllKeyInCache();
  });

  describe("getGpuPrices", () => {
    it("returns empty availability when no GPUs available", async () => {
      const { service } = setup({
        gpusForPricing: [],
        deploymentsWithGpu: [],
        days: []
      });

      const result = await service.getGpuPrices(false);

      expect(result.availability.total).toBe(0);
      expect(result.availability.available).toBe(0);
      expect(result.models).toHaveLength(0);
    });

    it("returns GPU models with availability data", async () => {
      const gpus = [createGpuType({ allocatable: 10, allocated: 3 }), createGpuType({ allocatable: 5, allocated: 2 })];

      const { service } = setup({
        gpusForPricing: gpus,
        deploymentsWithGpu: [],
        days: []
      });

      const result = await service.getGpuPrices(false);

      expect(result.availability.total).toBe(15);
      expect(result.availability.available).toBe(10);
      expect(result.models).toHaveLength(2);
    });

    it("calculates prices from bids for matching GPU models", async () => {
      const provider1 = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "a100",
        ram: "80Gi",
        interface: "pcie",
        allocatable: 5,
        allocated: 2,
        providers: [provider1]
      });

      const bidData = createMsgCreateBidV5({
        provider: provider1.owner,
        gpuVendor: "nvidia",
        gpuModel: "a100",
        gpuRam: "80Gi",
        gpuInterface: "pcie"
      });

      const aktPrice = 3.5;
      const days = [createDay({ aktPrice })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(false);

      expect(result.models).toHaveLength(1);
      expect(result.models[0].vendor).toBe("nvidia");
      expect(result.models[0].model).toBe("a100");
      expect(result.models[0].price).not.toBeNull();
      expect(result.models[0].price?.currency).toBe("USD");
      expect(result.models[0].priceUakt).not.toBeNull();
      expect(result.models[0].priceUakt?.currency).toBe("uakt");
    });

    it("ignores bids with USDC denomination", async () => {
      const provider = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "h100",
        providers: [provider]
      });

      const bidData = createMsgCreateBidV5({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "h100",
        denom: "ibc/usdc"
      });

      const days = [createDay({ aktPrice: 3.0 })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0].price).toBeNull();
      expect(result.models[0].priceUakt).toBeNull();
    });

    it("ignores bids for days without AKT price", async () => {
      const provider = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "rtx4090",
        providers: [provider]
      });

      const bidData = createMsgCreateBidV5({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "rtx4090"
      });

      const days = [createDay({ aktPrice: null })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0].price).toBeNull();
    });

    it("ignores bids for deployments with multiple GPU types", async () => {
      const provider = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "a100",
        providers: [provider]
      });

      const bidData = createMsgCreateBidV5WithMultipleGpuTypes({
        provider: provider.owner,
        gpuTypes: [
          { vendor: "nvidia", model: "a100", ram: "80Gi", interface: "pcie" },
          { vendor: "nvidia", model: "h100", ram: "80Gi", interface: "pcie" }
        ]
      });

      const days = [createDay({ aktPrice: 3.0 })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0].price).toBeNull();
    });

    it("supports v1beta4 MsgCreateBid messages", async () => {
      const provider = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "a100",
        ram: "40Gi",
        interface: "pcie",
        providers: [provider]
      });

      const bidData = createMsgCreateBidV4({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "a100",
        gpuRam: "40Gi",
        gpuInterface: "pcie"
      });

      const days = [createDay({ aktPrice: 3.0 })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta4.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0].price).not.toBeNull();
    });

    it("prefers bids from pricing bot when available", async () => {
      const provider = createProvider();
      const pricingBotAddress = "akash1pricingbot123";
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "h100",
        providers: [provider]
      });

      const regularBid = createMsgCreateBidV5({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "h100",
        priceAmount: "1000"
      });

      const pricingBotBid = createMsgCreateBidV5({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "h100",
        priceAmount: "500",
        cpuUnits: 100
      });

      const days = [createDay({ aktPrice: 3.0 })];
      const regularDeployment = createDeploymentWithBid({
        owner: faker.string.alphanumeric(43),
        dayId: days[0].id,
        bidData: regularBid.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`,
        height: 100
      });

      const pricingBotDeployment = createDeploymentWithBid({
        owner: pricingBotAddress,
        dayId: days[0].id,
        bidData: pricingBotBid.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`,
        height: 200
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [regularDeployment, pricingBotDeployment],
        days,
        pricingBotAddress
      });

      const result = await service.getGpuPrices(true);

      expect(result.models[0].providersWithBestBid).toHaveLength(1);
      expect(result.models[0].providersWithBestBid![0].bestBid.deployment.owner).toBe(pricingBotAddress);
    });

    it("includes debug information when debug flag is true", async () => {
      const provider = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "a100",
        providers: [provider]
      });

      const bidData = createMsgCreateBidV5({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "a100"
      });

      const days = [createDay({ aktPrice: 3.0 })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(true);

      expect(result.models[0].bidCount).toBeDefined();
      expect(result.models[0].providersWithBestBid).toBeDefined();
      expect(result.models[0].providerAvailability.providers).toBeDefined();
    });

    it("excludes debug information when debug flag is false", async () => {
      const gpu = createGpuType();

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [],
        days: []
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0].bidCount).toBeUndefined();
      expect(result.models[0].providersWithBestBid).toBeUndefined();
      expect(result.models[0].providerAvailability.providers).toBeUndefined();
    });

    it("sorts GPU models by vendor, model, ram, interface", async () => {
      const gpus = [
        createGpuType({ vendor: "nvidia", model: "h100", ram: "80Gi", interface: "sxm" }),
        createGpuType({ vendor: "amd", model: "mi300", ram: "192Gi", interface: "pcie" }),
        createGpuType({ vendor: "nvidia", model: "a100", ram: "40Gi", interface: "pcie" }),
        createGpuType({ vendor: "nvidia", model: "a100", ram: "80Gi", interface: "pcie" })
      ];

      const { service } = setup({
        gpusForPricing: gpus,
        deploymentsWithGpu: [],
        days: []
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0]).toMatchObject({ vendor: "amd", model: "mi300" });
      expect(result.models[1]).toMatchObject({ vendor: "nvidia", model: "a100", ram: "40Gi" });
      expect(result.models[2]).toMatchObject({ vendor: "nvidia", model: "a100", ram: "80Gi" });
      expect(result.models[3]).toMatchObject({ vendor: "nvidia", model: "h100" });
    });

    it("throws error when no block is found", async () => {
      const { service, akashBlockRepository } = setup({
        gpusForPricing: [],
        deploymentsWithGpu: [],
        days: []
      });

      akashBlockRepository.getFirstBlockAfter.mockResolvedValue(null);

      await expect(service.getGpuPrices(false)).rejects.toThrow("No block found");
    });

    it("calculates price statistics correctly for multiple providers", async () => {
      const provider1 = createProvider({ allocatable: 10 });
      const provider2 = createProvider({ allocatable: 5 });

      const gpu = createGpuType({
        vendor: "nvidia",
        model: "a100",
        ram: "80Gi",
        interface: "pcie",
        allocatable: 15,
        allocated: 0,
        providers: [provider1, provider2]
      });

      const bid1 = createMsgCreateBidV5({
        provider: provider1.owner,
        gpuVendor: "nvidia",
        gpuModel: "a100",
        gpuRam: "80Gi",
        gpuInterface: "pcie",
        priceAmount: "100"
      });

      const bid2 = createMsgCreateBidV5({
        provider: provider2.owner,
        gpuVendor: "nvidia",
        gpuModel: "a100",
        gpuRam: "80Gi",
        gpuInterface: "pcie",
        priceAmount: "200"
      });

      const days = [createDay({ aktPrice: 1.0 })];
      const deployment1 = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bid1.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const deployment2 = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bid2.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment1, deployment2],
        days
      });

      const result = await service.getGpuPrices(false);

      expect(result.models[0].price).not.toBeNull();
      expect(result.models[0].price?.min).toBeDefined();
      expect(result.models[0].price?.max).toBeDefined();
      expect(result.models[0].price?.avg).toBeDefined();
      expect(result.models[0].price?.med).toBeDefined();
      expect(result.models[0].price?.weightedAverage).toBeDefined();
    });

    it("matches SXM interface variants correctly", async () => {
      const provider = createProvider();
      const gpu = createGpuType({
        vendor: "nvidia",
        model: "h100",
        interface: "sxm5",
        providers: [provider]
      });

      const bidData = createMsgCreateBidV5({
        provider: provider.owner,
        gpuVendor: "nvidia",
        gpuModel: "h100",
        gpuInterface: "sxm"
      });

      const days = [createDay({ aktPrice: 3.0 })];
      const deployment = createDeploymentWithBid({
        dayId: days[0].id,
        bidData: bidData.encoded,
        bidType: `/akash.market.v1beta5.MsgCreateBid`
      });

      const { service } = setup({
        gpusForPricing: [gpu],
        deploymentsWithGpu: [deployment],
        days
      });

      const result = await service.getGpuPrices(true);

      expect(result.models[0].providersWithBestBid).toHaveLength(1);
    });
  });

  function setup(input: {
    gpusForPricing: GpuType[];
    deploymentsWithGpu: ReturnType<typeof createDeploymentWithBid>[];
    days: ReturnType<typeof createDay>[];
    pricingBotAddress?: string;
  }) {
    const gpuRepository = mock<GpuRepository>();
    const deploymentRepository = mock<DeploymentRepository>();
    const akashBlockRepository = mock<AkashBlockRepository>();
    const dayRepository = mock<DayRepository>();
    const logger = mock<LoggerService>();

    const gpuConfig: GpuConfig = {
      PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: 180,
      PRICING_BOT_ADDRESS: input.pricingBotAddress ?? "akash1pas6v0905jgyznpvnjhg7tsthuyqek60gkz7uf"
    };

    const typeRegistry = container.resolve<Registry>(TYPE_REGISTRY);

    gpuRepository.getGpusForPricing.mockResolvedValue(input.gpusForPricing);
    akashBlockRepository.getFirstBlockAfter.mockResolvedValue({ height: 1000 } as AkashBlock);
    deploymentRepository.findAllWithGpuResources.mockReturnValue(
      (async function* () {
        for (const deployment of input.deploymentsWithGpu) {
          yield deployment;
        }
      })() as never
    );
    dayRepository.getDaysAfter.mockResolvedValue(input.days as Day[]);

    const service = new GpuPriceService(gpuRepository, deploymentRepository, akashBlockRepository, dayRepository, gpuConfig, typeRegistry, logger);

    return { service, gpuRepository, deploymentRepository, akashBlockRepository, dayRepository, logger };
  }

  function createProvider(overrides?: Partial<GpuType["providers"][0]>) {
    return {
      owner: faker.string.alphanumeric(43),
      hostUri: faker.internet.url(),
      allocated: 0,
      allocatable: overrides?.allocatable ?? 5,
      ...overrides
    };
  }

  function createGpuType(overrides?: Partial<GpuType>): GpuType {
    const provider = overrides?.providers?.[0] ?? createProvider();
    return {
      vendor: faker.helpers.arrayElement(["nvidia", "amd"]),
      model: faker.helpers.arrayElement(["a100", "h100", "rtx4090"]),
      ram: faker.helpers.arrayElement(["40Gi", "80Gi", "24Gi"]),
      interface: faker.helpers.arrayElement(["pcie", "sxm"]),
      allocatable: 5,
      allocated: 0,
      providers: [provider],
      availableProviders: [provider],
      ...overrides
    };
  }

  function createDay(overrides?: { aktPrice?: number | null }) {
    const id = faker.string.uuid();
    return {
      id,
      date: subDays(new Date(), faker.number.int({ min: 1, max: 30 })),
      aktPrice: overrides && "aktPrice" in overrides ? overrides.aktPrice : 3.0
    };
  }

  function createDeploymentWithBid(input: { owner?: string; dayId: string; bidData: Uint8Array; bidType: string; height?: number }) {
    const height = input.height ?? faker.number.int({ min: 1000, max: 100000 });
    return {
      id: faker.string.uuid(),
      owner: input.owner ?? faker.string.alphanumeric(43),
      relatedMessages: [
        {
          height,
          data: input.bidData,
          type: input.bidType,
          block: {
            height,
            dayId: input.dayId,
            datetime: subDays(new Date(), faker.number.int({ min: 1, max: 14 }))
          },
          transaction: {
            hash: faker.string.hexadecimal({ length: 64 })
          }
        }
      ]
    };
  }

  function createMsgCreateBidV5(input: {
    provider: string;
    gpuVendor: string;
    gpuModel: string;
    gpuRam?: string;
    gpuInterface?: string;
    gpuCount?: number;
    priceAmount?: string;
    denom?: string;
    cpuUnits?: number;
  }) {
    const gpuCount = input.gpuCount ?? 1;
    const cpuUnits = input.cpuUnits ?? 1000;
    const memoryUnits = 1073741824;
    const storageUnits = 10737418240;
    const gpuRam = input.gpuRam ?? "80Gi";
    const gpuInterface = input.gpuInterface ?? "pcie";

    const gpuAttributes = [
      {
        key: `vendor/${input.gpuVendor}/model/${input.gpuModel}/ram/${gpuRam}/interface/${gpuInterface}`,
        value: "true"
      }
    ];

    const bid = MsgCreateBidV5.fromPartial({
      id: {
        owner: faker.string.alphanumeric(43),
        dseq: faker.number.int({ min: 1, max: 1000000 }),
        gseq: 1,
        oseq: 1,
        bseq: 1,
        provider: input.provider
      },
      price: {
        denom: input.denom ?? "uakt",
        amount: input.priceAmount ?? faker.number.int({ min: 100, max: 10000 }).toString()
      },
      deposit: {
        sources: []
      },
      resourcesOffer: [
        {
          resources: {
            id: 1,
            cpu: {
              units: {
                val: new TextEncoder().encode(cpuUnits.toString())
              },
              attributes: []
            },
            memory: {
              quantity: {
                val: new TextEncoder().encode(memoryUnits.toString())
              },
              attributes: []
            },
            storage: [
              {
                name: "default",
                quantity: {
                  val: new TextEncoder().encode(storageUnits.toString())
                },
                attributes: []
              }
            ],
            gpu: {
              units: {
                val: new TextEncoder().encode(gpuCount.toString())
              },
              attributes: gpuAttributes
            },
            endpoints: []
          },
          count: 1
        }
      ]
    });

    const encoded = MsgCreateBidV5.encode(bid).finish();
    return { bid, encoded };
  }

  function createMsgCreateBidV5WithMultipleGpuTypes(input: {
    provider: string;
    gpuTypes: { vendor: string; model: string; ram: string; interface: string }[];
  }) {
    const cpuUnits = 1000;
    const memoryUnits = 1073741824;
    const storageUnits = 10737418240;

    const gpuAttributes = input.gpuTypes.map(gpu => ({
      key: `vendor/${gpu.vendor}/model/${gpu.model}/ram/${gpu.ram}/interface/${gpu.interface}`,
      value: "true"
    }));

    const bid = MsgCreateBidV5.fromPartial({
      id: {
        owner: faker.string.alphanumeric(43),
        dseq: faker.number.int({ min: 1, max: 1000000 }),
        gseq: 1,
        oseq: 1,
        bseq: 1,
        provider: input.provider
      },
      price: {
        denom: "uakt",
        amount: faker.number.int({ min: 100, max: 10000 }).toString()
      },
      deposit: {
        sources: []
      },
      resourcesOffer: [
        {
          resources: {
            id: 1,
            cpu: {
              units: {
                val: new TextEncoder().encode(cpuUnits.toString())
              },
              attributes: []
            },
            memory: {
              quantity: {
                val: new TextEncoder().encode(memoryUnits.toString())
              },
              attributes: []
            },
            storage: [
              {
                name: "default",
                quantity: {
                  val: new TextEncoder().encode(storageUnits.toString())
                },
                attributes: []
              }
            ],
            gpu: {
              units: {
                val: new TextEncoder().encode(input.gpuTypes.length.toString())
              },
              attributes: gpuAttributes
            },
            endpoints: []
          },
          count: 1
        }
      ]
    });

    const encoded = MsgCreateBidV5.encode(bid).finish();
    return { bid, encoded };
  }

  function createMsgCreateBidV4(input: {
    provider: string;
    gpuVendor: string;
    gpuModel: string;
    gpuRam?: string;
    gpuInterface?: string;
    gpuCount?: number;
    priceAmount?: string;
    denom?: string;
    cpuUnits?: number;
  }) {
    const gpuCount = input.gpuCount ?? 1;
    const cpuUnits = input.cpuUnits ?? 1000;
    const memoryUnits = 1073741824;
    const storageUnits = 10737418240;
    const gpuRam = input.gpuRam ?? "80Gi";
    const gpuInterface = input.gpuInterface ?? "pcie";

    const gpuAttributes = [
      {
        $type: "akash.base.v1beta3.Attribute" as const,
        key: `vendor/${input.gpuVendor}/model/${input.gpuModel}/ram/${gpuRam}/interface/${gpuInterface}`,
        value: "true"
      }
    ];

    const bid = MsgCreateBidV4.fromPartial({
      order: {
        owner: faker.string.alphanumeric(43),
        dseq: faker.number.int({ min: 1, max: 1000000 }),
        gseq: 1,
        oseq: 1
      },
      provider: input.provider,
      price: {
        denom: input.denom ?? "uakt",
        amount: input.priceAmount ?? faker.number.int({ min: 100, max: 10000 }).toString()
      },
      deposit: {
        denom: "uakt",
        amount: "5000000"
      },
      resourcesOffer: [
        {
          resources: {
            id: 1,
            cpu: {
              units: {
                val: new TextEncoder().encode(cpuUnits.toString())
              },
              attributes: []
            },
            memory: {
              quantity: {
                val: new TextEncoder().encode(memoryUnits.toString())
              },
              attributes: []
            },
            storage: [
              {
                name: "default",
                quantity: {
                  val: new TextEncoder().encode(storageUnits.toString())
                },
                attributes: []
              }
            ],
            gpu: {
              units: {
                val: new TextEncoder().encode(gpuCount.toString())
              },
              attributes: gpuAttributes
            },
            endpoints: []
          },
          count: 1
        }
      ]
    });

    const encoded = MsgCreateBidV4.encode(bid).finish();
    return { bid, encoded };
  }
});
