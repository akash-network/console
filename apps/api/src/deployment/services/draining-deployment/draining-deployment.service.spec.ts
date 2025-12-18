import "@test/mocks/logger-service.mock";

import type { AnyAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import { addWeeks } from "date-fns";
import { mock } from "jest-mock-extended";
import { groupBy } from "lodash";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { LoggerService } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DrainingDeploymentOutput, LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DrainingDeploymentRpcService } from "../draining-deployment-rpc/draining-deployment-rpc.service";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(DrainingDeploymentService.name, () => {
  describe("findDrainingDeploymentsByOwner", () => {
    it("paginates draining deployments by owner and marks closed ones as such", async () => {
      const { service, deploymentSettingRepository, leaseRepository, loggerService, currentHeight } = setup();
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(4);
      const addresses = deploymentSettings.map(s => s.address);
      const dseqs = deploymentSettings.map(s => Number(s.dseq));

      const activeBatches: DrainingDeploymentOutput[][] = [
        [
          {
            dseq: dseqs[0],
            owner: addresses[0],
            denom: "uakt",
            blockRate: faker.number.int({ min: 50, max: 100 }),
            predictedClosedHeight: faker.number.int({ min: 900000, max: 1000000 })
          }
        ],
        [
          {
            dseq: dseqs[3],
            owner: addresses[3],
            denom: "uakt",
            blockRate: faker.number.int({ min: 50, max: 100 }),
            predictedClosedHeight: faker.number.int({ min: 900000, max: 1000000 })
          }
        ]
      ];

      const closedBatch: DrainingDeploymentOutput[] = [
        {
          dseq: dseqs[1],
          owner: addresses[1],
          denom: "uakt",
          blockRate: faker.number.int({ min: 50, max: 100 }),
          predictedClosedHeight: currentHeight + 1000,
          closedHeight: currentHeight - 100
        }
      ];

      jest
        .spyOn(service, "findLeases")
        .mockResolvedValueOnce(activeBatches[0])
        .mockResolvedValueOnce(closedBatch)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(activeBatches[1]);

      const deploymentSettingsByAddress = groupBy(deploymentSettings, "address");
      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          for (const [address, settings] of Object.entries(deploymentSettingsByAddress)) {
            yield { address, deploymentSettings: settings };
          }
        })()
      );

      const callback = jest.fn();
      for await (const result of service.findDrainingDeploymentsByOwner()) {
        callback(result);
      }

      expect(leaseRepository.findManyByDseqAndOwner).not.toHaveBeenCalled();
      expect(loggerService.error).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.updateManyById).toHaveBeenCalledWith(expect.arrayContaining([expect.any(String)]), { closed: true });

      expect(callback).toHaveBeenCalledTimes(activeBatches.length);
      activeBatches.forEach((batch, index) => {
        const deployment = batch[0];
        expect(callback).toHaveBeenNthCalledWith(
          index + 1,
          expect.objectContaining({
            address: deployment.owner,
            deployments: expect.arrayContaining([
              expect.objectContaining({
                dseq: deployment.dseq.toString(),
                address: deployment.owner
              })
            ])
          })
        );
      });
    });
  });

  describe("findLeases", () => {
    it("returns leases from RPC service when successful", async () => {
      const { service, rpcService } = setup();
      const closureHeight = 1007200;
      const owner = createAkashAddress();
      const dseqs = [faker.string.numeric(6), faker.string.numeric(6)];
      const expectedLeases: DrainingDeploymentOutput[] = [
        DrainingDeploymentSeeder.create({ owner, dseq: Number(dseqs[0]) }),
        DrainingDeploymentSeeder.create({ owner, dseq: Number(dseqs[1]) })
      ];

      rpcService.findManyByDseqAndOwner.mockResolvedValue(expectedLeases);

      const result = await service.findLeases(closureHeight, owner, dseqs);

      expect(rpcService.findManyByDseqAndOwner).toHaveBeenCalledWith(closureHeight, owner, dseqs);
      expect(result).toEqual(expectedLeases);
    });

    it("falls back to database when RPC fails", async () => {
      const { service, rpcService, leaseRepository, loggerService } = setup();
      const closureHeight = 1007200;
      const owner = createAkashAddress();
      const dseqs = [faker.string.numeric(6), faker.string.numeric(6)];
      const rpcError = new Error("RPC error");
      const expectedLeases: DrainingDeploymentOutput[] = [
        DrainingDeploymentSeeder.create({ owner, dseq: Number(dseqs[0]) }),
        DrainingDeploymentSeeder.create({ owner, dseq: Number(dseqs[1]) })
      ];

      rpcService.findManyByDseqAndOwner.mockRejectedValue(rpcError);
      leaseRepository.findManyByDseqAndOwner.mockResolvedValue(expectedLeases);

      const result = await service.findLeases(closureHeight, owner, dseqs);

      expect(rpcService.findManyByDseqAndOwner).toHaveBeenCalledWith(closureHeight, owner, dseqs);
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "LEASE_RPC_QUERY_FAILED_FALLBACK_TO_DB",
          message: expect.stringContaining("RPC query failed for owner"),
          owner,
          error: rpcError
        })
      );
      expect(leaseRepository.findManyByDseqAndOwner).toHaveBeenCalledWith(closureHeight, owner, dseqs);
      expect(result).toEqual(expectedLeases);
    });

    it("returns empty array when dseqs is empty", async () => {
      const { service, rpcService } = setup();
      const closureHeight = 1007200;
      const owner = createAkashAddress();

      const result = await service.findLeases(closureHeight, owner, []);

      expect(rpcService.findManyByDseqAndOwner).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("calculateTopUpAmount", () => {
    it("calculates amount for integer block rate", async () => {
      const { service } = setup();
      const result = await service.calculateTopUpAmount({ blockRate: 50 });
      expect(result).toBe(90000);
    });

    it("floors decimal block rate", async () => {
      const { service } = setup();
      const result = await service.calculateTopUpAmount({ blockRate: 10.7 });
      expect(result).toBe(19260);
    });
  });

  describe("calculateTopUpAmountForDseqAndUserId", () => {
    it("calculates top up amount for valid deployment", async () => {
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      const address = createAkashAddress();
      const userWallet = UserWalletSeeder.create({ address });
      const deployment = DrainingDeploymentSeeder.create();
      const expectedTopUpAmount = 100000;

      const { service, userWalletRepository, leaseRepository } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
      leaseRepository.findOneByDseqAndOwner.mockResolvedValue(deployment);
      jest.spyOn(service, "calculateTopUpAmount").mockResolvedValue(expectedTopUpAmount);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, address);
      expect(service.calculateTopUpAmount).toHaveBeenCalledWith(deployment);
      expect(amount).toBe(expectedTopUpAmount);
    });

    it("returns 0 when user wallet not found", async () => {
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      const { service, userWalletRepository, leaseRepository } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(undefined);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).not.toHaveBeenCalled();
      expect(amount).toBe(0);
    });

    it("returns 0 when lease not found", async () => {
      const userId = faker.string.uuid();
      const dseq = faker.string.numeric(6);
      const address = createAkashAddress();
      const userWallet = UserWalletSeeder.create({ address });
      const { service, userWalletRepository, leaseRepository } = setup();
      userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);
      leaseRepository.findOneByDseqAndOwner.mockResolvedValue(null);

      const amount = await service.calculateTopUpAmountForDseqAndUserId(dseq, userId);

      expect(userWalletRepository.findOneByUserId).toHaveBeenCalledWith(userId);
      expect(leaseRepository.findOneByDseqAndOwner).toHaveBeenCalledWith(dseq, address);
      expect(amount).toBe(0);
    });
  });

  describe("calculateWeeklyDeploymentCost", () => {
    it("calculates weekly cost for all active deployments", async () => {
      const blockRate1 = 50;
      const blockRate2 = 75;
      const baseSetup = setup();
      const deployments = [
        { predictedClosedHeight: baseSetup.currentHeight + 100, blockRate: blockRate1 },
        { predictedClosedHeight: baseSetup.currentHeight + 200, blockRate: blockRate2 }
      ];

      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments,
        expectedFiatAmount: 12.5
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(12.5);
    });

    it("includes deployments closing after 7 days", async () => {
      const blockRate = 50;
      const baseSetup = setup();
      const blocksInAWeek = Math.floor(averageBlockCountInAnHour * 24 * 7);
      const deploymentClosingAfterWeek = {
        predictedClosedHeight: baseSetup.currentHeight + blocksInAWeek + 1000,
        blockRate
      };

      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: [deploymentClosingAfterWeek],
        expectedFiatAmount: 5.0
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(5.0);
    });

    it("returns 0 when user wallet not found", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        userWallet: undefined,
        deployments: [{ predictedClosedHeight: 1000100, blockRate: 50 }]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("returns 0 when user wallet has no address", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        userWallet: UserWalletSeeder.create({ address: null }),
        deployments: [{ predictedClosedHeight: 1000100, blockRate: 50 }]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("returns 0 when no deployments found", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: []
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("excludes deployments with null predictedClosedHeight", async () => {
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: [{ predictedClosedHeight: null as unknown as number, blockRate: 50 }]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("excludes deployments closing at or before currentHeight", async () => {
      const baseSetup = setup();
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: [
          { predictedClosedHeight: baseSetup.currentHeight - 100, blockRate: 50 },
          { predictedClosedHeight: baseSetup.currentHeight, blockRate: 75 }
        ]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    it("excludes deployments with blockRate <= 0", async () => {
      const baseSetup = setup();
      const { service, userId, ability } = await setupCalculateWeeklyCost({
        deployments: [
          { predictedClosedHeight: baseSetup.currentHeight + 100, blockRate: 0 },
          { predictedClosedHeight: baseSetup.currentHeight + 200, blockRate: -10 }
        ]
      });

      const result = await service.calculateWeeklyDeploymentCost(userId, ability);

      expect(result).toBe(0);
    });

    async function setupCalculateWeeklyCost(input: {
      userWallet?: ReturnType<typeof UserWalletSeeder.create> | undefined;
      deployments: Array<{ predictedClosedHeight: number | null; blockRate: number }>;
      expectedFiatAmount?: number;
    }) {
      const userId = faker.string.uuid();
      const address = createAkashAddress();
      const userWallet = "userWallet" in input ? input.userWallet : UserWalletSeeder.create({ address, userId });
      const ability = mock<AnyAbility>();

      const baseSetup = setup();
      baseSetup.userWalletRepository.accessibleBy.mockReturnValue(baseSetup.userWalletRepository);
      baseSetup.userWalletRepository.findOneByUserId.mockResolvedValue(userWallet);

      baseSetup.deploymentSettingRepository.accessibleBy.mockReturnValue(baseSetup.deploymentSettingRepository);
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(input.deployments.length, { address });

      const drainingDeployments = deploymentSettings.map((setting, idx) => {
        const deployment = input.deployments[idx];
        const predictedClosedHeight = deployment?.predictedClosedHeight;
        return DrainingDeploymentSeeder.create({
          dseq: Number(setting.dseq),
          owner: address,
          blockRate: deployment?.blockRate ?? 0,
          predictedClosedHeight: predictedClosedHeight === null ? baseSetup.currentHeight - 1 : predictedClosedHeight ?? baseSetup.currentHeight + 100
        });
      });

      baseSetup.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(deploymentSettings);

      baseSetup.rpcService.findManyByDseqAndOwner.mockRejectedValue(new Error("RPC error"));
      baseSetup.leaseRepository.findManyByDseqAndOwner.mockImplementation((_closureHeight, _owner, _dseqs) => Promise.resolve(drainingDeployments));

      baseSetup.balancesService.toFiatAmount.mockImplementation(async (uaktAmount: number) => {
        if (uaktAmount === 0) {
          return 0;
        }
        return input.expectedFiatAmount ?? 0;
      });

      return {
        ...baseSetup,
        userId,
        ability
      };
    }
  });

  describe("calculateAllDeploymentCostUntilDate", () => {
    it("calculates total cost for deployments closing within target date", async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

      try {
        const blockRate1 = 50;
        const blockRate2 = 75;
        const baseSetup = setup();
        const deployments = [
          { predictedClosedHeight: baseSetup.currentHeight + 100, blockRate: blockRate1 },
          { predictedClosedHeight: baseSetup.currentHeight + 200, blockRate: blockRate2 }
        ];

        const { service, address, targetDate, leaseRepository } = await setupCalculateCost({
          deployments
        });
        const expectedTargetHeight = 1100800;
        const expectedTotal = 12600000;

        const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

        expect(result).toBe(expectedTotal);
        expect(leaseRepository.findManyByDseqAndOwner).toHaveBeenCalledWith(expectedTargetHeight, address, expect.any(Array));
      } finally {
        jest.useRealTimers();
      }
    });

    it("returns 0 when user wallet not found", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        userWallet: undefined,
        deployments: [{ predictedClosedHeight: 1000100, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("returns 0 when user wallet has no address", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        userWallet: UserWalletSeeder.create({ address: null }),
        deployments: [{ predictedClosedHeight: 1000100, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("returns 0 when no deployments found", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: []
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments with null predictedClosedHeight", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: [{ predictedClosedHeight: null as unknown as number, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments closing before currentHeight", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: [{ predictedClosedHeight: 999900, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments closing after targetHeight", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        deployments: [{ predictedClosedHeight: 3000000, blockRate: 50 }]
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    async function setupCalculateCost(input: {
      userWallet?: ReturnType<typeof UserWalletSeeder.create> | undefined;
      deployments: Array<{ predictedClosedHeight: number | null; blockRate: number }>;
    }) {
      const address = createAkashAddress();
      const userWallet = "userWallet" in input ? input.userWallet : UserWalletSeeder.create({ address });
      const now = new Date();
      const targetDate = addWeeks(now, 1);

      const baseSetup = setup();
      baseSetup.userWalletRepository.findOneBy.mockResolvedValue(userWallet);

      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(input.deployments.length, { address });

      const drainingDeployments = deploymentSettings.map((setting, idx) => {
        const deployment = input.deployments[idx];
        const predictedClosedHeight = deployment?.predictedClosedHeight ?? undefined;
        return DrainingDeploymentSeeder.create({
          dseq: Number(setting.dseq),
          owner: address,
          predictedClosedHeight: predictedClosedHeight === null ? undefined : predictedClosedHeight,
          blockRate: deployment?.blockRate ?? 0
        });
      });

      baseSetup.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(deploymentSettings);

      baseSetup.rpcService.findManyByDseqAndOwner.mockRejectedValue(new Error("RPC error"));
      baseSetup.leaseRepository.findManyByDseqAndOwner.mockImplementation((_closureHeight, _owner, _dseqs) => Promise.resolve(drainingDeployments));

      return {
        ...baseSetup,
        address,
        targetDate
      };
    }
  });

  function setup() {
    const currentHeight = 1000000;

    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(currentHeight);

    const leaseRepository = mock<LeaseRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const rpcService = mock<DrainingDeploymentRpcService>();
    const loggerService = mock<LoggerService>();
    const balancesService = mock<BalancesService>();

    rpcService.findManyByDseqAndOwner.mockResolvedValue([]);

    const config = mockConfigService<DeploymentConfigService>({
      AUTO_TOP_UP_JOB_INTERVAL_IN_H: 1,
      AUTO_TOP_UP_DEPLOYMENT_INTERVAL_IN_H: 3
    });

    const service = new DrainingDeploymentService(
      blockHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      config,
      loggerService,
      rpcService,
      balancesService
    );

    return {
      service,
      blockHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      rpcService,
      loggerService,
      balancesService,
      config,
      currentHeight
    };
  }
});
