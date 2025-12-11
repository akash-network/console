import "@test/mocks/logger-service.mock";

import type { DeploymentHttpService, DeploymentListResponse, LeaseHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { addWeeks } from "date-fns";
import { mock } from "jest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { LoggerService } from "@src/core";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { LeaseRepository } from "@src/deployment/repositories/lease/lease.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import { DrainingDeploymentService } from "./draining-deployment.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createAkashAddress } from "@test/seeders";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { LeaseApiResponseSeeder } from "@test/seeders/lease-api-response.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(DrainingDeploymentService.name, () => {
  describe("findDrainingDeploymentsByOwner", () => {
    const CURRENT_HEIGHT = 1000000;
    const BLOCK_RATE_1 = 50;
    const BLOCK_RATE_2 = 75;
    const PREDICTED_CLOSURE_OFFSET_1 = 100;
    const PREDICTED_CLOSURE_OFFSET_2 = 200;

    it("paginates draining deployments by owner and marks closed ones as such", async () => {
      const { service, blockHttpService, leaseHttpService, deploymentSettingRepository, loggerService, leaseRepository, deploymentHttpService } = setup({
        currentHeight: CURRENT_HEIGHT
      });
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(4);
      const addresses = deploymentSettings.map(s => s.address);
      const dseqs = deploymentSettings.map(s => Number(s.dseq));

      const rpcLeases = [
        LeaseApiResponseSeeder.create({
          owner: addresses[0],
          dseq: String(dseqs[0]),
          gseq: 0,
          oseq: 0,
          state: "active",
          price: { denom: "uakt", amount: String(BLOCK_RATE_1) }
        }),
        LeaseApiResponseSeeder.create({
          owner: addresses[1],
          dseq: String(dseqs[1]),
          gseq: 0,
          oseq: 0,
          state: "closed",
          price: { denom: "uakt", amount: String(BLOCK_RATE_2) },
          closed_on: String(CURRENT_HEIGHT - 100)
        }),
        LeaseApiResponseSeeder.create({
          owner: addresses[3],
          dseq: String(dseqs[3]),
          gseq: 0,
          oseq: 0,
          state: "active",
          price: { denom: "uakt", amount: String(BLOCK_RATE_1) }
        })
      ];

      const CREATED_HEIGHT_1 = CURRENT_HEIGHT - 5000;
      const CREATED_HEIGHT_2 = CURRENT_HEIGHT - 3000;
      const CREATED_HEIGHT_3 = CURRENT_HEIGHT - 4000;
      const deploymentBalances = [
        { dseq: String(dseqs[0]), funds: 40000, transferred: 20000, createdHeight: CREATED_HEIGHT_1 },
        { dseq: String(dseqs[1]), funds: 50000, transferred: 35000, createdHeight: CREATED_HEIGHT_2 },
        { dseq: String(dseqs[3]), funds: 30000, transferred: 30000, createdHeight: CREATED_HEIGHT_3 }
      ];
      const expectedPredictedHeight1 = 996200; // Math.ceil(995000 + 60000 / 50)
      const expectedPredictedHeight3 = 997200; // Math.ceil(996000 + 60000 / 50)

      leaseHttpService.list.mockImplementation(params => {
        const ownerLeases = rpcLeases.filter(l => l.lease.id.owner === params.owner);
        return Promise.resolve({
          leases: ownerLeases,
          pagination: { next_key: null, total: String(ownerLeases.length) }
        });
      });

      deploymentHttpService.findAll.mockImplementation(params => {
        const ownerDeployments = deploymentBalances
          .filter(d => deploymentSettings.some(s => s.dseq === d.dseq && s.address === params.owner))
          .map(d => ({
            deployment: {
              id: {
                dseq: d.dseq
              },
              created_at: String(d.createdHeight)
            },
            escrow_account: {
              state: {
                funds: [{ denom: "uakt", amount: String(d.funds) }],
                transferred: [{ denom: "uakt", amount: String(d.transferred) }]
              }
            }
          }));
        return Promise.resolve({
          deployments: ownerDeployments,
          pagination: { next_key: null, total: String(ownerDeployments.length) }
        } as unknown as DeploymentListResponse);
      });

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          const byAddress = deploymentSettings.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push(deployment);
              return acc;
            },
            {} as Record<string, typeof deploymentSettings>
          );

          for (const [address, settings] of Object.entries(byAddress)) {
            yield { address, deploymentSettings: settings };
          }
        })()
      );

      const callback = jest.fn();
      for await (const result of service.findDrainingDeploymentsByOwner()) {
        callback(result);
      }

      expect(blockHttpService.getCurrentHeight).toHaveBeenCalledTimes(1);
      expect(deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively).toHaveBeenCalled();
      expect(leaseHttpService.list).toHaveBeenCalledWith({
        owner: addresses[0],
        pagination: { limit: 1000, key: undefined }
      });

      expect(leaseRepository.findManyByDseqAndOwner).not.toHaveBeenCalled();
      expect(loggerService.error).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.updateManyById).toHaveBeenCalledWith(expect.arrayContaining([deploymentSettings[1].id]), { closed: true });
      expect(deploymentHttpService.findAll).toHaveBeenCalled();

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          address: addresses[0],
          deployments: expect.arrayContaining([
            expect.objectContaining({
              dseq: dseqs[0].toString(),
              address: addresses[0],
              predictedClosedHeight: expectedPredictedHeight1,
              blockRate: BLOCK_RATE_1
            })
          ])
        })
      );
      expect(callback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          address: addresses[3],
          deployments: expect.arrayContaining([
            expect.objectContaining({
              dseq: dseqs[3].toString(),
              address: addresses[3],
              predictedClosedHeight: expectedPredictedHeight3,
              blockRate: BLOCK_RATE_1
            })
          ])
        })
      );
    });

    it("paginates draining deployments by owner using database fallback when RPC fails", async () => {
      const { service, blockHttpService, leaseRepository, deploymentSettingRepository, config, leaseHttpService, loggerService } = setup({
        currentHeight: CURRENT_HEIGHT
      });
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(4);
      const addresses = deploymentSettings.map(s => s.address);
      const dseqs = deploymentSettings.map(s => Number(s.dseq));

      const drainingDeployments = [
        DrainingDeploymentSeeder.create({
          dseq: dseqs[0],
          owner: addresses[0],
          predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
          blockRate: BLOCK_RATE_1
        }),
        DrainingDeploymentSeeder.create({
          dseq: dseqs[1],
          owner: addresses[1],
          predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_2,
          blockRate: BLOCK_RATE_2,
          closedHeight: CURRENT_HEIGHT - 100
        }),
        DrainingDeploymentSeeder.create({
          dseq: dseqs[3],
          owner: addresses[3],
          predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
          blockRate: BLOCK_RATE_1
        })
      ];

      const rpcError = new Error("RPC error");
      leaseHttpService.list.mockRejectedValue(rpcError);

      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          const byAddress = deploymentSettings.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push(deployment);
              return acc;
            },
            {} as Record<string, typeof deploymentSettings>
          );

          for (const [address, settings] of Object.entries(byAddress)) {
            yield { address, deploymentSettings: settings };
          }
        })()
      );

      leaseRepository.findManyByDseqAndOwner.mockImplementation((_closureHeight, owner, dseqs) => {
        return Promise.resolve(drainingDeployments.filter(d => d.owner === owner && dseqs.includes(String(d.dseq))));
      });

      const callback = jest.fn();
      for await (const result of service.findDrainingDeploymentsByOwner()) {
        callback(result);
      }

      const expectedClosureHeight = Math.floor(CURRENT_HEIGHT + averageBlockCountInAnHour * 2 * config.get("AUTO_TOP_UP_JOB_INTERVAL_IN_H"));

      expect(blockHttpService.getCurrentHeight).toHaveBeenCalledTimes(1);
      expect(deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively).toHaveBeenCalled();
      expect(leaseHttpService.list).toHaveBeenCalled();
      expect(leaseRepository.findManyByDseqAndOwner).toHaveBeenCalledWith(expectedClosureHeight, addresses[0], expect.arrayContaining([String(dseqs[0])]));
      expect(loggerService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "LEASE_RPC_QUERY_FAILED_FALLBACK_TO_DB",
          message: expect.stringContaining("RPC query failed for owner"),
          owner: addresses[0],
          error: rpcError
        })
      );

      expect(deploymentSettingRepository.updateManyById).toHaveBeenCalledWith(expect.arrayContaining([deploymentSettings[1].id]), { closed: true });

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          address: addresses[0],
          deployments: expect.arrayContaining([
            expect.objectContaining({
              dseq: dseqs[0].toString(),
              address: addresses[0],
              predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
              blockRate: BLOCK_RATE_1
            })
          ])
        })
      );
      expect(callback).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          address: addresses[3],
          deployments: expect.arrayContaining([
            expect.objectContaining({
              dseq: dseqs[3].toString(),
              address: addresses[3],
              predictedClosedHeight: CURRENT_HEIGHT + PREDICTED_CLOSURE_OFFSET_1,
              blockRate: BLOCK_RATE_1
            })
          ])
        })
      );
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

  describe("calculateAllDeploymentCostUntilDate", () => {
    const CURRENT_HEIGHT = 1000000;
    const BLOCK_RATE_1 = 50;
    const BLOCK_RATE_2 = 75;

    it("calculates total cost for deployments closing within target date", async () => {
      // Given: 2 deployments that will close before target date
      // - Deployment 1: closes at height 1000100 (100 blocks from now), blockRate 50
      // - Deployment 2: closes at height 1000200 (200 blocks from now), blockRate 75
      // Target date is 1 week from now
      // The method calculates blocksNeeded = targetHeight - currentHeight for all deployments
      // Expected: blocksNeeded = targetHeight - currentHeight
      //           amount1 = 50 * blocksNeeded, amount2 = 75 * blocksNeeded
      //           total = (50 + 75) * blocksNeeded = 125 * blocksNeeded
      const deployments = [
        { predictedClosedHeight: CURRENT_HEIGHT + 100, blockRate: BLOCK_RATE_1 },
        { predictedClosedHeight: CURRENT_HEIGHT + 200, blockRate: BLOCK_RATE_2 }
      ];

      const { service, address, targetDate } = await setupCalculateCost({
        currentHeight: CURRENT_HEIGHT,
        deployments
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      // Calculate expected: blocksNeeded = targetHeight - currentHeight
      // For 1 week: targetHeight = currentHeight + averageBlockCountInAnHour * (7 * 24)
      // blocksNeeded = averageBlockCountInAnHour * 168
      const hoursInWeek = 7 * 24;
      const expectedBlocksNeeded = Math.floor(averageBlockCountInAnHour * hoursInWeek);
      const expectedTotal = (BLOCK_RATE_1 + BLOCK_RATE_2) * expectedBlocksNeeded;

      // Allow for small differences in date calculations (±2 blocks = ±250 with total rate of 125)
      expect(result).toBeGreaterThanOrEqual(expectedTotal - 250);
      expect(result).toBeLessThanOrEqual(expectedTotal + 250);
    });

    it("returns 0 when user wallet not found", async () => {
      const deployments = [{ predictedClosedHeight: CURRENT_HEIGHT + 100, blockRate: BLOCK_RATE_1 }];

      const { service, address, targetDate } = await setupCalculateCost({
        userWallet: undefined,
        deployments
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("returns 0 when user wallet has no address", async () => {
      const deployments = [{ predictedClosedHeight: CURRENT_HEIGHT + 100, blockRate: BLOCK_RATE_1 }];

      const { service, address, targetDate } = await setupCalculateCost({
        userWallet: UserWalletSeeder.create({ address: null }),
        deployments
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("returns 0 when no deployments found", async () => {
      const { service, address, targetDate } = await setupCalculateCost({
        currentHeight: CURRENT_HEIGHT,
        deployments: []
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments with null predictedClosedHeight", async () => {
      const deployments = [{ predictedClosedHeight: null as unknown as number, blockRate: BLOCK_RATE_1 }];

      const { service, address, targetDate } = await setupCalculateCost({
        currentHeight: CURRENT_HEIGHT,
        deployments
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments closing before currentHeight", async () => {
      // Given: deployment closes 100 blocks before current height
      const deployments = [{ predictedClosedHeight: CURRENT_HEIGHT - 100, blockRate: BLOCK_RATE_1 }];

      const { service, address, targetDate } = await setupCalculateCost({
        currentHeight: CURRENT_HEIGHT,
        deployments
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    it("excludes deployments closing after targetHeight", async () => {
      // Given: deployment closes way after target date (2M blocks later)
      const deployments = [{ predictedClosedHeight: CURRENT_HEIGHT + 2000000, blockRate: BLOCK_RATE_1 }];

      const { service, address, targetDate } = await setupCalculateCost({
        currentHeight: CURRENT_HEIGHT,
        deployments
      });

      const result = await service.calculateAllDeploymentCostUntilDate(address, targetDate);

      expect(result).toBe(0);
    });

    async function setupCalculateCost(input: {
      currentHeight?: number;
      userWallet?: ReturnType<typeof UserWalletSeeder.create> | undefined;
      deployments: Array<{ predictedClosedHeight: number | null; blockRate: number }>;
    }) {
      const currentHeight = input.currentHeight ?? CURRENT_HEIGHT;
      const address = createAkashAddress();
      const userWallet = "userWallet" in input ? input.userWallet : UserWalletSeeder.create({ address });
      const now = new Date();
      const targetDate = addWeeks(now, 1);

      const baseSetup = setup({ currentHeight });
      baseSetup.userWalletRepository.findOneBy.mockResolvedValue(userWallet);

      const deployments = input.deployments;
      const deploymentSettings = AutoTopUpDeploymentSeeder.createMany(deployments.length, { address });

      const drainingDeployments = deploymentSettings.map((setting, idx) => {
        const deployment = deployments[idx];
        const predictedClosedHeight = deployment?.predictedClosedHeight ?? undefined;
        return DrainingDeploymentSeeder.create({
          dseq: Number(setting.dseq),
          owner: address,
          predictedClosedHeight: predictedClosedHeight === null ? undefined : predictedClosedHeight,
          blockRate: deployment?.blockRate ?? 0
        });
      });

      baseSetup.deploymentSettingRepository.findAutoTopUpDeploymentsByOwner.mockResolvedValue(deploymentSettings);

      baseSetup.leaseHttpService.list.mockRejectedValue(new Error("RPC error"));
      baseSetup.leaseRepository.findManyByDseqAndOwner.mockImplementation((_closureHeight, _owner, _dseqs) => Promise.resolve(drainingDeployments));

      return {
        ...baseSetup,
        address,
        targetDate
      };
    }
  });

  function setup(input?: { currentHeight?: number }) {
    const CURRENT_BLOCK_HEIGHT = 7481457;
    const currentHeight = input?.currentHeight ?? CURRENT_BLOCK_HEIGHT;

    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(currentHeight);

    const leaseRepository = mock<LeaseRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneBy.mockResolvedValue(undefined);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const leaseHttpService = mock<LeaseHttpService>();
    const deploymentHttpService = mock<DeploymentHttpService>();
    const loggerService = mock<LoggerService>();

    leaseHttpService.list.mockResolvedValue({
      leases: [],
      pagination: { next_key: null, total: "0" }
    });

    deploymentHttpService.findAll.mockResolvedValue({
      deployments: [],
      pagination: { next_key: null, total: "0" }
    });

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
      leaseHttpService,
      loggerService,
      deploymentHttpService
    );

    return {
      service,
      blockHttpService,
      leaseRepository,
      userWalletRepository,
      deploymentSettingRepository,
      leaseHttpService,
      deploymentHttpService,
      loggerService,
      config
    };
  }
});
