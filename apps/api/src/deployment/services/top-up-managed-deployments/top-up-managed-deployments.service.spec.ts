import "@test/mocks/logger-service.mock";

import { Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { IndexedTx } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type { DrainingDeployment, DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { mockConfigService } from "../../../../test/mocks/config-service.mock";
import type { CachedBalance, CachedBalanceService } from "../cached-balance/cached-balance.service";
import type { FundDrainingDeploymentsInstrumentationService } from "./fund-draining-deployments-instrumentation.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";
import type { TopUpManagedDeploymentsInstrumentationService } from "./top-up-managed-deployments-instrumentation.service";

import { createAkashAddress } from "@test/seeders";
import { createAutoTopUpDeployment, createManyAutoTopUpDeployments } from "@test/seeders/auto-top-up-deployment.seeder";
import { createDrainingDeployment } from "@test/seeders/draining-deployment.seeder";

describe(TopUpManagedDeploymentsService.name, () => {
  const DEPLOYMENT_GRANT_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const CLAIMED_AT = "2026-08-19 06:24:27.123456";
  const SUFFICIENT_FEE_ALLOWANCE = 100001;

  function createFundingClaim(id: string) {
    return { id, claimedAt: CLAIMED_AT };
  }

  function createMockCachedBalance(reserveSufficientAmount: (desiredAmount: number) => number) {
    const balance = mock<CachedBalance>();
    balance.reserveSufficientAmount.mockImplementation(reserveSufficientAmount);
    return balance;
  }

  describe("topUpDeployments", () => {
    it("should top up draining deployments", async () => {
      const {
        service,
        drainingDeploymentService,
        cachedBalanceService,
        managedSignerService,
        instrumentation,
        fundDrainingInstrumentation,
        walletReloadService
      } = setup();
      const deployments = createManyAutoTopUpDeployments(2);
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
                ...createDrainingDeployment({
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
            yield { address, walletId: items[0].walletId, deployments: items };
          }
        })()
      );

      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(desiredAmount);
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
        expect(instrumentation.recordDeposit).toHaveBeenCalledWith(
          expect.objectContaining({
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
            ]
          })
        );
      });

      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
      deployments.forEach(deployment => {
        expect(walletReloadService.scheduleImmediate).toHaveBeenCalledWith({ walletId: deployment.walletId });
      });

      expect(fundDrainingInstrumentation.recordDeposit).not.toHaveBeenCalled();
    });

    it("sizes every owner in the sweep from a single block height", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, blockHttpService } = setup();
      const deployments = createManyAutoTopUpDeployments(3);

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          for (const deployment of deployments) {
            const draining = {
              ...deployment,
              ...createDrainingDeployment({
                dseq: Number(deployment.dseq),
                owner: deployment.address,
                predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
                denom: DEPLOYMENT_GRANT_DENOM
              }),
              dseq: deployment.dseq
            } as DrainingDeployment;
            yield { address: deployment.address, walletId: deployment.walletId, deployments: [draining] };
          }
        })()
      );
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 1000000));

      await service.topUpDeployments({ dryRun: false });

      expect(drainingDeploymentService.findDrainingDeploymentsByOwner).toHaveBeenCalledWith(CURRENT_BLOCK_HEIGHT);
      expect(drainingDeploymentService.calculateAmountToTargetRunway).toHaveBeenCalledTimes(deployments.length);
      drainingDeploymentService.calculateAmountToTargetRunway.mock.calls.forEach(([, height]) => {
        expect(height).toBe(CURRENT_BLOCK_HEIGHT);
      });
      expect(blockHttpService.getCurrentHeight).toHaveBeenCalledTimes(2);
    });

    it("should handle errors and continue processing", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const deployments = createManyAutoTopUpDeployments(2);
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
                ...createDrainingDeployment({
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
            yield { address, walletId: items[0].walletId, deployments: items };
          }
        })()
      );

      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValueOnce(1000000).mockImplementationOnce(() => {
        throw new Error("Failed to calculate amount");
      });

      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
    });

    it("should not execute transactions in dry run mode", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, walletReloadService, deploymentSettingRepository } = setup();
      const deployments = createManyAutoTopUpDeployments(2);
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
                ...createDrainingDeployment({
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
            yield { address, walletId: items[0].walletId, deployments: items };
          }
        })()
      );
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: true });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleImmediate).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.claimForFunding).not.toHaveBeenCalled();
    });

    it("should not execute transactions if no draining deployments", async () => {
      const { service, drainingDeploymentService, managedSignerService } = setup();
      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() => (async function* () {})());

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("schedules a check for a non-draining auto-top-up owner", async () => {
      const { service, drainingDeploymentService, deploymentSettingRepository, walletReloadService, managedSignerService } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() => (async function* () {})());
      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          yield { address: owner, walletId, deploymentSettings: [createAutoTopUpDeployment({ address: owner, walletId })] };
        })()
      );

      await service.topUpDeployments({ dryRun: false });

      expect(walletReloadService.scheduleImmediate).toHaveBeenCalledWith({ walletId });
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("does not schedule extra checks for auto-top-up owners on dry run", async () => {
      const { service, drainingDeploymentService, deploymentSettingRepository, walletReloadService } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() => (async function* () {})());
      deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() =>
        (async function* () {
          yield { address: owner, walletId, deploymentSettings: [createAutoTopUpDeployment({ address: owner, walletId })] };
        })()
      );

      await service.topUpDeployments({ dryRun: true });

      expect(walletReloadService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("should top up draining deployments for the same owner in the same tx", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployments = [createAutoTopUpDeployment({ address: owner, walletId }), createAutoTopUpDeployment({ address: owner, walletId })];
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
                ...createDrainingDeployment({
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
            yield { address, walletId: items[0].walletId, deployments: items };
          }
        })()
      );

      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(desiredAmount);
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
      const { service, drainingDeploymentService, instrumentation } = setup();
      const deployment = createAutoTopUpDeployment();
      const error = new Error("Failed to calculate amount");

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const items: DrainingDeployment[] = [
            {
              ...deployment,
              ...createDrainingDeployment({
                dseq: Number(deployment.dseq),
                owner: deployment.address,
                predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500
              }),
              dseq: deployment.dseq
            } as DrainingDeployment
          ];
          yield { address: deployment.address, walletId: deployment.walletId, deployments: items };
        })()
      );

      drainingDeploymentService.calculateAmountToTargetRunway.mockImplementation(() => {
        throw error;
      });

      await service.topUpDeployments({ dryRun: false });

      expect(instrumentation.recordMessagePreparationError).toHaveBeenCalledWith(
        expect.objectContaining({
          deployment: expect.objectContaining({
            address: deployment.address,
            walletId: deployment.walletId
          }),
          error
        })
      );

      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
    });

    it("should handle master wallet insufficient funds error and stop processing", async () => {
      const { service, chainErrorService, managedSignerService, drainingDeploymentService, cachedBalanceService, instrumentation } = setup();
      const deployments = createManyAutoTopUpDeployments(3);
      const error = new Error(`insufficient funds: 10uakt is smaller than 20uakt`);
      const mockTx = mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" });

      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValueOnce(true).mockResolvedValue(false);
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(error).mockResolvedValue(mockTx);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...createDrainingDeployment({
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
            yield { address, walletId: items[0].walletId, deployments: items };
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
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(instrumentation.recordMasterWalletInsufficientFundsError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(instrumentation.finish).toHaveBeenCalledWith("failure", CURRENT_BLOCK_HEIGHT);
    });

    it("should handle user wallet insufficient funds error and continue processing", async () => {
      const { service, chainErrorService, managedSignerService, drainingDeploymentService, cachedBalanceService, instrumentation } = setup();
      const deployments = createManyAutoTopUpDeployments(3);
      const error = new Error(`insufficient funds: 10uakt is smaller than 20uakt`);

      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);
      const mockTx = mock<IndexedTx>({
        code: 0,
        hash: "tx-hash",
        rawLog: "success"
      });
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(error).mockResolvedValueOnce(mockTx).mockResolvedValueOnce(mockTx);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          const byAddress = deployments.reduce(
            (acc, deployment) => {
              if (!acc[deployment.address]) {
                acc[deployment.address] = [];
              }
              acc[deployment.address].push({
                ...deployment,
                ...createDrainingDeployment({
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
            yield { address, walletId: items[0].walletId, deployments: items };
          }
        })()
      );
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
    });

    it("should call ensureFeeGrants before executing top-up", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const deployment = createAutoTopUpDeployment();
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          yield {
            address: deployment.address,
            walletId: deployment.walletId,
            deployments: [
              {
                ...deployment,
                ...createDrainingDeployment({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
                dseq: deployment.dseq
              } as DrainingDeployment
            ]
          };
        })()
      );
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.ensureFeeGrants).toHaveBeenCalledWith({
        address: deployment.address,
        isTrialing: deployment.walletIsTrialing,
        createdAt: deployment.walletCreatedAt,
        activatedAt: deployment.walletActivatedAt
      });
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
    });

    it("should not execute top-up when fee grant is missing and cannot be refilled", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, instrumentation } = setup({ feeAllowance: 0 });
      const deployment = createAutoTopUpDeployment();
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          yield {
            address: deployment.address,
            walletId: deployment.walletId,
            deployments: [
              {
                ...deployment,
                ...createDrainingDeployment({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
                dseq: deployment.dseq
              } as DrainingDeployment
            ]
          };
        })()
      );
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.ensureFeeGrants).toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: expect.stringContaining("Fee grant missing") })
        })
      );
    });

    it("should skip fee grant validation in dry run mode", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const deployment = createAutoTopUpDeployment();
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          yield {
            address: deployment.address,
            walletId: deployment.walletId,
            deployments: [
              {
                ...deployment,
                ...createDrainingDeployment({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
                dseq: deployment.dseq
              } as DrainingDeployment
            ]
          };
        })()
      );
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: true });

      expect(managedSignerService.ensureFeeGrants).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });
  });

  describe("topUpDrainingDeploymentsForOwner", () => {
    it("funds the owner's draining deployments in a single tx and schedules a wallet reload", async () => {
      const {
        service,
        drainingDeploymentService,
        cachedBalanceService,
        managedSignerService,
        walletReloadService,
        fundDrainingInstrumentation,
        instrumentation
      } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const sufficientAmount = faker.number.int({ min: 1000000, max: 2000000 });

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([createDrainingFor(owner, walletId), createDrainingFor(owner, walletId)]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(faker.number.int({ min: 3500000, max: 4000000 }));
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => sufficientAmount));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(drainingDeploymentService.findDrainingDeploymentsForOwner).toHaveBeenCalledWith(owner, fundDrainingInstrumentation, CURRENT_BLOCK_HEIGHT);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(walletId, [
        expect.objectContaining({ typeUrl: "/akash.escrow.v1.MsgAccountDeposit" }),
        expect.objectContaining({ typeUrl: "/akash.escrow.v1.MsgAccountDeposit" })
      ]);
      expect(walletReloadService.scheduleImmediate).toHaveBeenCalledWith({ walletId });
      expect(fundDrainingInstrumentation.recordDeposit).toHaveBeenCalledWith(expect.objectContaining({ owner }));
      expect(instrumentation.recordDeposit).not.toHaveBeenCalled();
      expect(instrumentation.start).not.toHaveBeenCalled();
      expect(instrumentation.finish).not.toHaveBeenCalled();
    });

    it("reads a fresh balance rather than the memoized one so the long-running worker never funds from a stale balance", async () => {
      const { service, drainingDeploymentService, cachedBalanceService } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([createDrainingFor(owner, walletId)]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(cachedBalanceService.getFresh).toHaveBeenCalledWith(owner);
      expect(cachedBalanceService.get).not.toHaveBeenCalled();
    });

    it("records a nothing-to-fund skip and funds nothing when the owner has no draining deployments", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, walletReloadService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([]);

      await service.topUpDrainingDeploymentsForOwner({ walletId: 1, address: owner });

      expect(fundDrainingInstrumentation.recordSkipped).toHaveBeenCalledWith({ owner, deploymentCount: 0 });
      expect(cachedBalanceService.getFresh).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("records a non-positive-amount skip without reporting a false insufficient-balance error", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, walletReloadService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);
      const balance = createMockCachedBalance(desiredAmount => {
        if (desiredAmount <= 0) {
          throw new Error(`Insufficient balance: 1000000 < ${desiredAmount}`);
        }
        return desiredAmount;
      });

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(0);
      cachedBalanceService.getFresh.mockResolvedValue(balance);

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordInvalidDepositAmount).toHaveBeenCalledWith(
        expect.objectContaining({ desiredAmount: 0, dseq: deployment.dseq, address: deployment.address })
      );
      expect(balance.reserveSufficientAmount).not.toHaveBeenCalled();
      expect(fundDrainingInstrumentation.recordMessagePreparationError).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("routes a master-wallet insufficient-funds failure to the immediate-funding instrumentation and rethrows", async () => {
      const {
        service,
        drainingDeploymentService,
        cachedBalanceService,
        managedSignerService,
        chainErrorService,
        fundDrainingInstrumentation,
        instrumentation
      } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const error = new Error("insufficient funds");

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([createDrainingFor(owner, walletId)]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      managedSignerService.executeDerivedTx.mockRejectedValue(error);
      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(true);

      await expect(service.topUpDrainingDeploymentsForOwner({ walletId, address: owner })).rejects.toThrow(error);

      expect(fundDrainingInstrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ owner, error }));
      expect(fundDrainingInstrumentation.recordMasterWalletInsufficientFundsError).toHaveBeenCalledWith(expect.objectContaining({ owner, error }));
      expect(instrumentation.recordChainTxError).not.toHaveBeenCalled();
    });

    it("claims deployments with the configured cooldown and funds only the ones this pass wins", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, deploymentSettingRepository } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const won = createDrainingFor(owner, walletId);
      const claimedByAnotherPass = createDrainingFor(owner, walletId);
      const balance = createMockCachedBalance(() => 1000000);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([won, claimedByAnotherPass]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(balance);
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(won.id)]);

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.claimForFunding).toHaveBeenCalledWith(expect.arrayContaining([won.id, claimedByAnotherPass.id]), 60);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(walletId, [
        expect.objectContaining({ value: expect.objectContaining({ id: expect.objectContaining({ xid: expect.stringContaining(`/${won.dseq}`) }) }) })
      ]);
      expect(balance.reserveSufficientAmount).toHaveBeenCalledOnce();
    });

    it("releases the claim of a deployment that produced no deposit message", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, deploymentSettingRepository } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const withAnomalousZeroAmount = createDrainingFor(owner, walletId);
      const fundable = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([withAnomalousZeroAmount, fundable]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValueOnce(0).mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.releaseFundingClaim).toHaveBeenCalledWith([createFundingClaim(withAnomalousZeroAmount.id)]);
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledWith(walletId, [
        expect.objectContaining({ value: expect.objectContaining({ id: expect.objectContaining({ xid: expect.stringContaining(`/${fundable.dseq}`) }) }) })
      ]);
    });

    it("keeps the claim of a landed deposit when recording it throws", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, deploymentSettingRepository, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(deployment.id)]);
      fundDrainingInstrumentation.recordDeposit.mockImplementation(() => {
        throw new Error("otel exporter down");
      });

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.releaseFundingClaim).not.toHaveBeenCalled();
    });

    it("reports a failed claim release without masking the chain error that caused it", async () => {
      const {
        service,
        drainingDeploymentService,
        cachedBalanceService,
        managedSignerService,
        chainErrorService,
        deploymentSettingRepository,
        fundDrainingInstrumentation
      } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);
      const releaseError = new Error("connection terminated");

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(deployment.id)]);
      deploymentSettingRepository.releaseFundingClaim.mockRejectedValue(releaseError);
      managedSignerService.executeDerivedTx.mockRejectedValue(new Error("insufficient funds"));
      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(true);

      await expect(service.topUpDrainingDeploymentsForOwner({ walletId, address: owner })).rejects.toThrow("insufficient funds");

      expect(fundDrainingInstrumentation.recordClaimReleaseError).toHaveBeenCalledWith(
        expect.objectContaining({ owner, deploymentIds: [deployment.id], error: releaseError })
      );
    });

    it("funds nothing and records a skip when another pass already claimed every deployment", async () => {
      const {
        service,
        drainingDeploymentService,
        cachedBalanceService,
        managedSignerService,
        walletReloadService,
        deploymentSettingRepository,
        fundDrainingInstrumentation
      } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([createDrainingFor(owner, walletId)]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([]);

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleImmediate).not.toHaveBeenCalled();
      expect(fundDrainingInstrumentation.recordSkipped).toHaveBeenCalledWith(expect.objectContaining({ owner }));
    });

    it("keeps the claim when the deposit succeeds", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, deploymentSettingRepository, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(deployment.id)]);

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordDeposit).toHaveBeenCalledWith(expect.objectContaining({ owner }));
      expect(deploymentSettingRepository.releaseFundingClaim).not.toHaveBeenCalled();
    });

    it("releases the claim and does not record a deposit when the tx lands with a non-OK code", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, deploymentSettingRepository, fundDrainingInstrumentation } =
        setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(deployment.id)]);
      managedSignerService.executeDerivedTx.mockResolvedValue(mock<IndexedTx>({ code: 11, hash: "tx-hash", rawLog: "out of gas" }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.releaseFundingClaim).toHaveBeenCalledWith([createFundingClaim(deployment.id)]);
      expect(fundDrainingInstrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ owner }));
      expect(fundDrainingInstrumentation.recordDeposit).not.toHaveBeenCalled();
    });

    it("releases the claim when the deposit throws so the next pass can retry", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, chainErrorService, deploymentSettingRepository } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(deployment.id)]);
      managedSignerService.executeDerivedTx.mockRejectedValue(new Error("broadcast timed out"));
      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.releaseFundingClaim).toHaveBeenCalledWith([createFundingClaim(deployment.id)]);
    });

    it("releases the claim before rethrowing a master-wallet insufficient-funds failure", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, chainErrorService, deploymentSettingRepository } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      deploymentSettingRepository.claimForFunding.mockResolvedValue([createFundingClaim(deployment.id)]);
      managedSignerService.executeDerivedTx.mockRejectedValue(new Error("insufficient funds"));
      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(true);

      await expect(service.topUpDrainingDeploymentsForOwner({ walletId, address: owner })).rejects.toThrow("insufficient funds");

      expect(deploymentSettingRepository.releaseFundingClaim).toHaveBeenCalledWith([createFundingClaim(deployment.id)]);
    });

    function createDrainingFor(owner: string, walletId: number, predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500): DrainingDeployment {
      const setting = createAutoTopUpDeployment({ address: owner, walletId });
      return {
        ...setting,
        ...createDrainingDeployment({ dseq: Number(setting.dseq), owner, predictedClosedHeight, denom: DEPLOYMENT_GRANT_DENOM }),
        dseq: setting.dseq
      } as DrainingDeployment;
    }
  });

  function setup(input?: { currentBlockHeight?: number; feeAllowance?: number }) {
    const currentBlockHeight = input?.currentBlockHeight ?? CURRENT_BLOCK_HEIGHT;
    const feeAllowance = input?.feeAllowance ?? SUFFICIENT_FEE_ALLOWANCE;

    const managedSignerService = mock<ManagedSignerService>();
    managedSignerService.ensureFeeGrants.mockResolvedValue(feeAllowance);
    managedSignerService.executeDerivedTx.mockResolvedValue(mock<IndexedTx>({ code: 0, hash: "tx-hash", rawLog: "success" }));
    const billingConfig = mockConfigService<BillingConfigService>({
      DEPLOYMENT_GRANT_DENOM,
      USDC_IBC_DENOMS: {
        mainnetId: DEPLOYMENT_GRANT_DENOM,
        sandboxId: DEPLOYMENT_GRANT_DENOM
      }
    });
    const drainingDeploymentService = mock<DrainingDeploymentService>();
    const rpcMessageService = new RpcMessageService(billingConfig);
    const cachedBalanceService = mock<CachedBalanceService>();
    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(currentBlockHeight);
    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);
    const instrumentation = mock<TopUpManagedDeploymentsInstrumentationService>();
    const fundDrainingInstrumentation = mock<FundDrainingDeploymentsInstrumentationService>();
    const walletReloadService = mock<WalletReloadJobService>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.claimForFunding.mockImplementation(async (ids: string[]) => ids.map(createFundingClaim));
    deploymentSettingRepository.releaseFundingClaim.mockResolvedValue(undefined);
    deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() => (async function* () {})());
    const deploymentConfig = mockConfigService<DeploymentConfigService>({ AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN: 60 });

    const service = new TopUpManagedDeploymentsService(
      managedSignerService,
      billingConfig,
      drainingDeploymentService,
      rpcMessageService,
      cachedBalanceService,
      blockHttpService,
      chainErrorService,
      instrumentation,
      fundDrainingInstrumentation,
      walletReloadService,
      deploymentSettingRepository,
      deploymentConfig
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
      instrumentation,
      fundDrainingInstrumentation,
      walletReloadService,
      deploymentSettingRepository,
      deploymentConfig
    };
  }
});
