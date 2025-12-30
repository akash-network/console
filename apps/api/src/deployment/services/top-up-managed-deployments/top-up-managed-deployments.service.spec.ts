import "@test/mocks/logger-service.mock";

import { Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { IndexedTx } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { mock } from "jest-mock-extended";

import { RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DrainingDeployment, DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { mockConfigService } from "../../../../test/mocks/config-service.mock";
import type { LoggerService } from "../../../core";
import type { CachedBalance, CachedBalanceService } from "../cached-balance/cached-balance.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { createAkashAddress } from "@test/seeders";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";

describe(TopUpManagedDeploymentsService.name, () => {
  const DEPLOYMENT_GRANT_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
  const CURRENT_BLOCK_HEIGHT = 7481457;

  function createMockCachedBalance(reserveSufficientAmount: (desiredAmount: number) => number) {
    const balance = mock<CachedBalance>();
    balance.reserveSufficientAmount.mockImplementation(reserveSufficientAmount);
    return balance;
  }

  describe("topUpDeployments", () => {
    it("should top up draining deployments", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, logger } = setup();
      const deployments = AutoTopUpDeploymentSeeder.createMany(2);
      const desiredAmount = faker.number.int({ min: 3500000, max: 4000000 });
      const sufficientAmount = faker.number.int({ min: 1000000, max: 2000000 });
      const predictedClosedHeight1 = CURRENT_BLOCK_HEIGHT + 1500;
      const predictedClosedHeight2 = CURRENT_BLOCK_HEIGHT + 1700;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment, index) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...DrainingDeploymentSeeder.create({
                  dseq: Number(deployment.dseq),
                  owner: deployment.address,
                  predictedClosedHeight: index === 0 ? predictedClosedHeight1 : predictedClosedHeight2,
                  denom: DEPLOYMENT_GRANT_DENOM
                }),
                dseq: deployment.dseq
              } as DrainingDeployment);
              return acc;
            },
            {} as Record<string, DrainingDeployment[]>
          );

          for (const [address, items] of Object.entries(byAddress)) {
            yield { address, deployments: items };
          }
        })()
      );

      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(desiredAmount);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => sufficientAmount));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(deployments.length);
      deployments.forEach((deployment, index) => {
        expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(deployment.walletId, [
          {
            typeUrl: "/akash.escrow.v1.MsgAccountDeposit",
            value: {
              signer: deployment.address,
              id: {
                scope: Scope.deployment,
                xid: `${deployment.address}/${deployment.dseq}`
              },
              deposit: {
                amount: {
                  denom: DEPLOYMENT_GRANT_DENOM,
                  amount: sufficientAmount.toString()
                },
                sources: [Source.grant]
              }
            }
          }
        ]);
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            event: "TOP_UP_DEPLOYMENTS_SUCCESS",
            owner: deployment.address,
            items: [
              expect.objectContaining({
                deployment: expect.objectContaining({
                  blockRate: expect.any(Number),
                  closedHeight: undefined,
                  denom: DEPLOYMENT_GRANT_DENOM,
                  dseq: deployment.dseq,
                  id: deployment.id,
                  owner: deployment.address,
                  address: deployment.address,
                  predictedClosedHeight: index === 0 ? predictedClosedHeight1 : predictedClosedHeight2,
                  walletId: deployment.walletId
                }),
                input: expect.objectContaining({
                  amount: sufficientAmount,
                  denom: DEPLOYMENT_GRANT_DENOM,
                  signer: deployment.address,
                  dseq: Number(deployment.dseq),
                  owner: deployment.address
                })
              })
            ],
            dryRun: false
          })
        );
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_DEPLOYMENTS_SUMMARY",
          summary: expect.objectContaining({
            startBlockHeight: CURRENT_BLOCK_HEIGHT,
            endBlockHeight: CURRENT_BLOCK_HEIGHT,
            deploymentCount: 2,
            deploymentTopUpCount: 2,
            deploymentTopUpErrorCount: 0,
            insufficientBalanceCount: 0,
            walletsCount: 2,
            walletsTopUpCount: 2,
            walletsTopUpErrorCount: 0,
            minPredictedClosedHeight: predictedClosedHeight1,
            maxPredictedClosedHeight: predictedClosedHeight2,
            totalTopUpAmount: expect.any(Number)
          }),
          dryRun: false
        })
      );
    });

    it("should handle errors and continue processing", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const deployments = AutoTopUpDeploymentSeeder.createMany(2);
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...DrainingDeploymentSeeder.create({
                  dseq: Number(deployment.dseq),
                  owner: deployment.address,
                  predictedClosedHeight
                }),
                dseq: deployment.dseq
              } as DrainingDeployment);
              return acc;
            },
            {} as Record<string, DrainingDeployment[]>
          );

          for (const [address, items] of Object.entries(byAddress)) {
            yield { address, deployments: items };
          }
        })()
      );

      drainingDeploymentService.calculateTopUpAmount.mockResolvedValueOnce(1000000).mockRejectedValueOnce(new Error("Failed to calculate amount"));

      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
    });

    it("should not execute transactions in dry run mode", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const deployments = AutoTopUpDeploymentSeeder.createMany(2);
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...DrainingDeploymentSeeder.create({
                  dseq: Number(deployment.dseq),
                  owner: deployment.address,
                  predictedClosedHeight
                }),
                dseq: deployment.dseq
              } as DrainingDeployment);
              return acc;
            },
            {} as Record<string, DrainingDeployment[]>
          );

          for (const [address, items] of Object.entries(byAddress)) {
            yield { address, deployments: items };
          }
        })()
      );
      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: true });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("should not execute transactions if no draining deployments", async () => {
      const { service, drainingDeploymentService, managedSignerService } = setup();
      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() => (async function* () {})());

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("should top up draining deployments for the same owner in the same tx", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployments = [AutoTopUpDeploymentSeeder.create({ address: owner, walletId }), AutoTopUpDeploymentSeeder.create({ address: owner, walletId })];
      const desiredAmount = faker.number.int({ min: 3500000, max: 4000000 });
      const sufficientAmount = faker.number.int({ min: 1000000, max: 2000000 });
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...DrainingDeploymentSeeder.create({
                  dseq: Number(deployment.dseq),
                  owner: deployment.address,
                  predictedClosedHeight
                }),
                dseq: deployment.dseq
              } as DrainingDeployment);
              return acc;
            },
            {} as Record<string, DrainingDeployment[]>
          );

          for (const [address, items] of Object.entries(byAddress)) {
            yield { address, deployments: items };
          }
        })()
      );

      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(desiredAmount);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => sufficientAmount));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(walletId, [
        {
          typeUrl: "/akash.escrow.v1.MsgAccountDeposit",
          value: {
            signer: owner,
            id: {
              scope: Scope.deployment,
              xid: `${owner}/${deployments[0].dseq}`
            },
            deposit: {
              amount: {
                denom: DEPLOYMENT_GRANT_DENOM,
                amount: sufficientAmount.toString()
              },
              sources: [Source.grant]
            }
          }
        },
        {
          typeUrl: "/akash.escrow.v1.MsgAccountDeposit",
          value: {
            signer: owner,
            id: {
              scope: Scope.deployment,
              xid: `${owner}/${deployments[1].dseq}`
            },
            deposit: {
              amount: {
                denom: DEPLOYMENT_GRANT_DENOM,
                amount: sufficientAmount.toString()
              },
              sources: [Source.grant]
            }
          }
        }
      ]);
    });

    it("should log errors when message preparation fails", async () => {
      const { service, drainingDeploymentService, logger } = setup();
      const deployment = AutoTopUpDeploymentSeeder.create();
      const error = new Error("Failed to calculate amount");

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const items: DrainingDeployment[] = [
            {
              ...deployment,
              ...DrainingDeploymentSeeder.create({
                dseq: Number(deployment.dseq),
                owner: deployment.address,
                predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500
              }),
              dseq: deployment.dseq
            } as DrainingDeployment
          ];
          yield { address: deployment.address, deployments: items };
        })()
      );

      drainingDeploymentService.calculateTopUpAmount.mockRejectedValue(error);

      await service.topUpDeployments({ dryRun: false });

      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "MESSAGE_PREPARATION_ERROR",
          deployment: expect.objectContaining({
            address: deployment.address,
            walletId: deployment.walletId
          }),
          message: error.message,
          dryRun: false,
          stack: expect.any(String)
        })
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_DEPLOYMENTS_SUMMARY",
          summary: expect.objectContaining({
            deploymentCount: 1,
            deploymentTopUpCount: 0,
            deploymentTopUpErrorCount: 1,
            insufficientBalanceCount: 0,
            walletsCount: 1,
            walletsTopUpCount: 0,
            walletsTopUpErrorCount: 1,
            minPredictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
            maxPredictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
            totalTopUpAmount: 0,
            startBlockHeight: CURRENT_BLOCK_HEIGHT,
            endBlockHeight: CURRENT_BLOCK_HEIGHT
          }),
          dryRun: false
        })
      );
    });

    it("should handle master wallet insufficient funds error and stop processing", async () => {
      const { service, chainErrorService, managedSignerService, drainingDeploymentService, cachedBalanceService, logger } = setup();
      const deployments = AutoTopUpDeploymentSeeder.createMany(3);
      const error = new Error(`insufficient funds: 10uakt is smaller than 20uakt`);
      const mockTx = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValueOnce(true).mockResolvedValue(false);
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(error).mockResolvedValue(mockTx);
      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(1000000);
      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...DrainingDeploymentSeeder.create({
                  dseq: Number(deployment.dseq),
                  owner: deployment.address,
                  predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
                  denom: DEPLOYMENT_GRANT_DENOM
                }),
                dseq: deployment.dseq
              } as DrainingDeployment);
              return acc;
            },
            {} as Record<string, DrainingDeployment[]>
          );

          for (const [address, items] of Object.entries(byAddress)) {
            yield { address, deployments: items };
          }
        })()
      );
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(
        expect.objectContaining({
          err: true,
          ok: false,
          val: [error]
        })
      );

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "MASTER_WALLET_INSUFFICIENT_FUNDS",
          message: error.message,
          dryRun: false
        })
      );
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_DEPLOYMENTS_SUMMARY",
          summary: expect.objectContaining({
            startBlockHeight: CURRENT_BLOCK_HEIGHT,
            endBlockHeight: CURRENT_BLOCK_HEIGHT,
            deploymentCount: 3,
            deploymentTopUpCount: 2,
            deploymentTopUpErrorCount: 1,
            insufficientBalanceCount: 0,
            walletsCount: 3,
            walletsTopUpCount: 2,
            walletsTopUpErrorCount: 1,
            minPredictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
            maxPredictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
            totalTopUpAmount: expect.any(Number)
          }),
          dryRun: false
        })
      );
    });

    it("should handle user wallet insufficient funds error and continue processing", async () => {
      const { service, chainErrorService, managedSignerService, drainingDeploymentService, cachedBalanceService, logger } = setup();
      const deployments = AutoTopUpDeploymentSeeder.createMany(3);
      const error = new Error(`insufficient funds: 10uakt is smaller than 20uakt`);

      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);
      const mockTx = mock<IndexedTx>({
        code: 0,
        hash: "tx-hash",
        rawLog: "success"
      });
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(error).mockResolvedValueOnce(mockTx).mockResolvedValueOnce(mockTx);
      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(1000000);
      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...DrainingDeploymentSeeder.create({
                  dseq: Number(deployment.dseq),
                  owner: deployment.address,
                  predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
                  denom: DEPLOYMENT_GRANT_DENOM
                }),
                dseq: deployment.dseq
              } as DrainingDeployment);
              return acc;
            },
            {} as Record<string, DrainingDeployment[]>
          );

          for (const [address, items] of Object.entries(byAddress)) {
            yield { address, deployments: items };
          }
        })()
      );
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_DEPLOYMENTS_ERROR",
          message: error.message,
          dryRun: false
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "TOP_UP_DEPLOYMENTS_SUMMARY",
          summary: expect.objectContaining({
            startBlockHeight: CURRENT_BLOCK_HEIGHT,
            endBlockHeight: CURRENT_BLOCK_HEIGHT,
            deploymentCount: 3,
            deploymentTopUpCount: 2,
            deploymentTopUpErrorCount: 1,
            insufficientBalanceCount: 1,
            walletsCount: 3,
            walletsTopUpCount: 2,
            walletsTopUpErrorCount: 1,
            minPredictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
            maxPredictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
            totalTopUpAmount: expect.any(Number)
          }),
          dryRun: false
        })
      );
    });
  });

  function setup(input?: { currentBlockHeight?: number }) {
    const currentBlockHeight = input?.currentBlockHeight ?? CURRENT_BLOCK_HEIGHT;

    const managedSignerService = mock<ManagedSignerService>();
    const billingConfig = mockConfigService<BillingConfigService>({
      DEPLOYMENT_GRANT_DENOM,
      USDC_IBC_DENOMS: {
        mainnetId: DEPLOYMENT_GRANT_DENOM,
        sandboxId: DEPLOYMENT_GRANT_DENOM
      }
    });
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const rpcMessageService = new RpcMessageService();
    const cachedBalanceService = mock<CachedBalanceService>();
    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(currentBlockHeight);
    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);
    const logger = mock<LoggerService>();

    const service = new TopUpManagedDeploymentsService(
      managedSignerService,
      billingConfig,
      drainingDeploymentService,
      rpcMessageService,
      cachedBalanceService,
      blockHttpService,
      chainErrorService,
      logger
    );

    return {
      service,
      managedSignerService,
      billingConfig,
      drainingDeploymentService,
      rpcMessageService,
      cachedBalanceService,
      blockHttpService,
      chainErrorService,
      logger
    };
  }
});
