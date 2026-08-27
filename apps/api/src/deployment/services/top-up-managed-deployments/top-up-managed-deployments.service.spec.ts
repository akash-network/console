import { Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { IndexedTx } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import { RpcMessageService } from "@src/billing/services";
import type { BalancesService } from "@src/billing/services/balances/balances.service";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { JobQueueService } from "@src/core";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import type {
  AutoTopUpOwnerDeployments,
  DrainingDeployment,
  DrainingDeploymentService
} from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { mockConfigService } from "../../../../test/mocks/config-service.mock";
import { CachedBalance, type CachedBalanceService } from "../cached-balance/cached-balance.service";
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
  const DEDUP_COOLDOWN_IN_MIN = 60;
  /** A deposit that reaches the 48h target runway, so it is never declined for being too small to outlast the cooldown. */
  const RUNWAY_MINUTES_AT_TARGET = 48 * 60;
  const MIN_DEPOSIT = 500_000;
  const HEADROOM = 5_000_000;

  function createFundingClaim(id: string) {
    return { id, claimedAt: CLAIMED_AT };
  }

  /** Mirrors `CachedBalance` with no floor held: one allowance answers every preview and the reservation. */
  function createMockCachedBalance(affordableAmount: (desiredAmount: number) => number) {
    const balance = mock<CachedBalance>();
    balance.previewSufficientAmount.mockImplementation(affordableAmount);
    balance.previewSufficientAmountWithoutHeadroom.mockImplementation(affordableAmount);
    balance.reserveSufficientAmount.mockImplementation(desiredAmount => {
      const amount = affordableAmount(desiredAmount);

      if (amount <= 0) {
        throw new Error(`Insufficient balance: ${amount} < ${desiredAmount}`);
      }

      return amount;
    });
    return balance;
  }

  function createOwnerYield(deployments: DrainingDeployment[], overrides?: Partial<AutoTopUpOwnerDeployments>): AutoTopUpOwnerDeployments {
    return {
      address: deployments[0].address,
      walletId: deployments[0].walletId,
      userId: deployments[0].userId,
      autoReloadEnabled: deployments[0].isWalletAutoTopUpEnabled,
      isTrialing: deployments[0].walletIsTrialing,
      creditsLowNotifiedAt: deployments[0].walletCreditsLowNotifiedAt,
      activeDeployments: deployments,
      drainingDeployments: deployments,
      ...overrides
    };
  }

  function createNonDrainingOwner(overrides?: Partial<AutoTopUpOwnerDeployments>): AutoTopUpOwnerDeployments {
    const setting = createAutoTopUpDeployment();
    const activeDeployment = {
      ...setting,
      ...createDrainingDeployment({
        dseq: Number(setting.dseq),
        owner: setting.address,
        predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1_000_000,
        denom: DEPLOYMENT_GRANT_DENOM
      }),
      dseq: setting.dseq
    } as DrainingDeployment;

    return createOwnerYield([activeDeployment], { drainingDeployments: [], ...overrides });
  }

  function mockOwnerYields(drainingDeploymentService: ReturnType<typeof mock<DrainingDeploymentService>>, ...owners: AutoTopUpOwnerDeployments[]) {
    drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
      (async function* () {
        for (const owner of owners) {
          yield owner;
        }
      })()
    );
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

          for (const items of Object.values(byAddress)) {
            yield createOwnerYield(items);
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
      const { service, drainingDeploymentService, cachedBalanceService, blockHttpService, instrumentation } = setup();
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
            yield createOwnerYield([draining]);
          }
        })()
      );
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 1000000));

      await service.topUpDeployments({ dryRun: false });

      expect(drainingDeploymentService.findDrainingDeploymentsByOwner).toHaveBeenCalledWith(CURRENT_BLOCK_HEIGHT, instrumentation, { dryRun: false });
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

          for (const items of Object.values(byAddress)) {
            yield createOwnerYield(items);
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

          for (const items of Object.values(byAddress)) {
            yield createOwnerYield(items);
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

    it("skips coverage evaluation for a non-draining owner with Auto Recharge on", async () => {
      const { service, drainingDeploymentService, walletReloadService, balancesService, managedSignerService } = setup();
      mockOwnerYields(drainingDeploymentService, createNonDrainingOwner({ autoReloadEnabled: true }));

      await service.topUpDeployments({ dryRun: false });

      expect(walletReloadService.scheduleCreditsLowCheck).not.toHaveBeenCalled();
      expect(drainingDeploymentService.calculateWeeklyCoverageCredits).not.toHaveBeenCalled();
      expect(balancesService.retrieveDeploymentLimit).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("skips coverage evaluation for a trialing non-draining owner", async () => {
      const { service, drainingDeploymentService, walletReloadService } = setup();
      mockOwnerYields(drainingDeploymentService, createNonDrainingOwner({ isTrialing: true }));

      await service.topUpDeployments({ dryRun: false });

      expect(walletReloadService.scheduleCreditsLowCheck).not.toHaveBeenCalled();
      expect(drainingDeploymentService.calculateWeeklyCoverageCredits).not.toHaveBeenCalled();
    });

    it("enqueues a credits-low check for a non-draining owner below a week of coverage", async () => {
      const { service, drainingDeploymentService, balancesService, jobQueueService } = setupWithWalletReloadJobs();
      const owner = createNonDrainingOwner();

      mockOwnerYields(drainingDeploymentService, owner);
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(700);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(100);

      await service.topUpDeployments({ dryRun: false });

      expect(drainingDeploymentService.calculateWeeklyCoverageCredits).toHaveBeenCalledWith(owner.activeDeployments, CURRENT_BLOCK_HEIGHT);
      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.any(WalletCreditsLowCheck),
        expect.objectContaining({
          singletonKey: `${WalletCreditsLowCheck.name}.${owner.userId}`
        })
      );
      expect(jobQueueService.enqueue).not.toHaveBeenCalledWith(expect.any(WalletBalanceReloadCheck), expect.anything());
    });

    it("does not enqueue for a low owner already stamped notified", async () => {
      const { service, drainingDeploymentService, balancesService, walletReloadService } = setup();
      mockOwnerYields(drainingDeploymentService, createNonDrainingOwner({ creditsLowNotifiedAt: faker.date.recent() }));
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(700);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(100);

      await service.topUpDeployments({ dryRun: false });

      expect(walletReloadService.scheduleCreditsLowCheck).not.toHaveBeenCalled();
    });

    it("enqueues a clearing check for a notified owner whose balance recovered", async () => {
      const { service, drainingDeploymentService, balancesService, walletReloadService } = setup();
      const owner = createNonDrainingOwner({ creditsLowNotifiedAt: faker.date.recent() });

      mockOwnerYields(drainingDeploymentService, owner);
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(700);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(1000);

      await service.topUpDeployments({ dryRun: false });

      expect(walletReloadService.scheduleCreditsLowCheck).toHaveBeenCalledWith(owner.userId, { withCleanup: true });
    });

    it("does not enqueue for a covered owner that was never notified", async () => {
      const { service, drainingDeploymentService, balancesService, walletReloadService } = setup();
      mockOwnerYields(drainingDeploymentService, createNonDrainingOwner());
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(700);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(1000);

      await service.topUpDeployments({ dryRun: false });

      expect(walletReloadService.scheduleCreditsLowCheck).not.toHaveBeenCalled();
    });

    it("skips the balance read for a zero-cost owner and only enqueues to clear a stale stamp", async () => {
      const { service, drainingDeploymentService, balancesService, walletReloadService } = setup();
      const unnotified = createNonDrainingOwner();
      const notified = createNonDrainingOwner({ creditsLowNotifiedAt: faker.date.recent() });

      mockOwnerYields(drainingDeploymentService, unnotified, notified);
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(0);

      await service.topUpDeployments({ dryRun: false });

      expect(balancesService.retrieveDeploymentLimit).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleCreditsLowCheck).toHaveBeenCalledTimes(1);
      expect(walletReloadService.scheduleCreditsLowCheck).toHaveBeenCalledWith(notified.userId, { withCleanup: true });
    });

    it("falls back to enqueueing the check when the inline evaluation fails", async () => {
      const { service, drainingDeploymentService, balancesService, walletReloadService, instrumentation } = setup();
      const owner = createNonDrainingOwner();
      const error = new Error("connection reset");

      mockOwnerYields(drainingDeploymentService, owner);
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(700);
      balancesService.retrieveDeploymentLimit.mockRejectedValue(error);

      const result = await service.topUpDeployments({ dryRun: false });

      expect(result.ok).toBe(true);
      expect(instrumentation.recordCreditsLowScheduleError).toHaveBeenCalledWith({ walletId: owner.walletId, error });
      expect(walletReloadService.scheduleCreditsLowCheck).toHaveBeenCalledWith(owner.userId, { withCleanup: true });
      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
    });

    it("does not evaluate coverage or schedule checks on dry run", async () => {
      const { service, drainingDeploymentService, balancesService, walletReloadService } = setup();
      mockOwnerYields(drainingDeploymentService, createNonDrainingOwner());
      drainingDeploymentService.calculateWeeklyCoverageCredits.mockReturnValue(700);
      balancesService.retrieveDeploymentLimit.mockResolvedValue(100);

      await service.topUpDeployments({ dryRun: true });

      expect(drainingDeploymentService.calculateWeeklyCoverageCredits).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleCreditsLowCheck).not.toHaveBeenCalled();
    });

    it("enqueues a post-funding credits-low check for a funded owner without an inline verdict", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, balancesService, walletReloadService, managedSignerService } = setup();
      const deployment = createAutoTopUpDeployment();
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

      mockOwnerYields(drainingDeploymentService, createOwnerYield([draining]));
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 1000000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(walletReloadService.scheduleCreditsLowCheck).toHaveBeenCalledWith(deployment.userId, { withCleanup: true });
      expect(drainingDeploymentService.calculateWeeklyCoverageCredits).not.toHaveBeenCalled();
      expect(balancesService.retrieveDeploymentLimit).not.toHaveBeenCalled();
    });

    it("still schedules the credits-low check when funding an owner throws", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, walletReloadService } = setup();
      const deployment = createAutoTopUpDeployment();
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

      mockOwnerYields(drainingDeploymentService, createOwnerYield([draining]));
      cachedBalanceService.get.mockRejectedValue(new Error("balance fetch failed"));

      const result = await service.topUpDeployments({ dryRun: false });

      expect(result.ok).toBe(false);
      expect(walletReloadService.scheduleCreditsLowCheck).toHaveBeenCalledWith(deployment.userId, { withCleanup: true });
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

          for (const items of Object.values(byAddress)) {
            yield createOwnerYield(items);
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
          yield createOwnerYield(items);
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

          for (const items of Object.values(byAddress)) {
            yield createOwnerYield(items);
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
      chainErrorService.isDeploymentClosedError.mockReturnValue(false);
      chainErrorService.getFailedMessageIndex.mockReturnValue(undefined);
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

          for (const items of Object.values(byAddress)) {
            yield createOwnerYield(items);
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
          yield createOwnerYield([
            {
              ...deployment,
              ...createDrainingDeployment({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
              dseq: deployment.dseq
            } as DrainingDeployment
          ]);
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
          yield createOwnerYield([
            {
              ...deployment,
              ...createDrainingDeployment({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
              dseq: deployment.dseq
            } as DrainingDeployment
          ]);
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
          yield createOwnerYield([
            {
              ...deployment,
              ...createDrainingDeployment({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
              dseq: deployment.dseq
            } as DrainingDeployment
          ]);
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

    it("schedules a credits-low check even when the owner has nothing to fund", async () => {
      const { service, drainingDeploymentService, walletReloadService } = setup();
      const owner = createAkashAddress();

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([]);

      await service.topUpDrainingDeploymentsForOwner({ walletId: 1, address: owner });

      expect(walletReloadService.scheduleCreditsLowCheckIfAutoReloadOff).toHaveBeenCalledWith({ walletId: 1 });
    });

    it("records a failed credits-low schedule without failing the funding job", async () => {
      const { service, drainingDeploymentService, walletReloadService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const error = new Error("connection reset");

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([]);
      vi.mocked(walletReloadService.scheduleCreditsLowCheckIfAutoReloadOff).mockRejectedValue(error);

      await expect(service.topUpDrainingDeploymentsForOwner({ walletId: 1, address: owner })).resolves.toBeUndefined();

      expect(fundDrainingInstrumentation.recordCreditsLowScheduleError).toHaveBeenCalledWith({ walletId: 1, error });
    });

    it("records a non-positive-amount skip without reporting a false insufficient-balance error", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, walletReloadService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);
      const balance = createMockCachedBalance(desiredAmount => desiredAmount);

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

    it("declines a credit-capped deposit that would buy less runway than the dedup cooldown", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, walletReloadService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);
      const balance = createMockCachedBalance(() => 1000);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(DEDUP_COOLDOWN_IN_MIN - 1);
      cachedBalanceService.getFresh.mockResolvedValue(balance);

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordDepositBelowUsefulRunway).toHaveBeenCalledWith({
        dseq: deployment.dseq,
        address: deployment.address,
        desiredAmount: 1000000,
        affordableAmount: 1000,
        runwayMinutes: DEDUP_COOLDOWN_IN_MIN - 1
      });
      expect(balance.reserveSufficientAmount).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(walletReloadService.scheduleImmediate).not.toHaveBeenCalled();
    });

    it("yields the balance headroom rather than decline a deposit the headroom alone made too small", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);
      const available = HEADROOM + 600_000;
      const desiredAmount = 50_000_000;

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(desiredAmount);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockImplementation((_deployment, amount) =>
        amount >= available ? RUNWAY_MINUTES_AT_TARGET : DEDUP_COOLDOWN_IN_MIN - 1
      );
      cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(available, { headroom: HEADROOM, minDeposit: MIN_DEPOSIT }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      const [, messages] = managedSignerService.executeDerivedTx.mock.calls[0];
      expect(messages[0].value.deposit?.amount?.amount).toBe(String(available));
      expect(fundDrainingInstrumentation.recordHeadroomConceded).toHaveBeenCalledWith({
        dseq: deployment.dseq,
        address: deployment.address,
        desiredAmount,
        flooredAmount: 600_000,
        affordableAmount: available,
        runwayMinutes: RUNWAY_MINUTES_AT_TARGET
      });
      expect(fundDrainingInstrumentation.recordDepositBelowUsefulRunway).not.toHaveBeenCalled();
    });

    it("yields the balance headroom to a deployment the rest of the batch left nothing for", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const first = createDrainingFor(owner, walletId);
      const second = createDrainingFor(owner, walletId);
      const aboveHeadroom = 5_600_000;
      const secondDesiredAmount = 3_000_000;

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([first, second]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockImplementation(deployment => (deployment === first ? aboveHeadroom : secondDesiredAmount));
      cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(HEADROOM + aboveHeadroom, { headroom: HEADROOM, minDeposit: MIN_DEPOSIT }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      const [, messages] = managedSignerService.executeDerivedTx.mock.calls[0];
      expect(messages.map(message => message.value.deposit?.amount?.amount)).toEqual([String(aboveHeadroom), String(secondDesiredAmount)]);
      expect(fundDrainingInstrumentation.recordHeadroomConceded).toHaveBeenCalledWith(
        expect.objectContaining({ dseq: second.dseq, flooredAmount: 0, affordableAmount: secondDesiredAmount })
      );
      expect(fundDrainingInstrumentation.recordMessagePreparationError).not.toHaveBeenCalled();
    });

    it("reports an exhausted allowance as insufficient balance when yielding the headroom releases nothing", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(3_000_000);
      cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(0, { headroom: HEADROOM, minDeposit: MIN_DEPOSIT }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordHeadroomConceded).not.toHaveBeenCalled();
      expect(fundDrainingInstrumentation.recordMessagePreparationError).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ message: expect.stringContaining("Insufficient balance") }) })
      );
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("keeps the balance headroom when the deposit it allows is already worth making", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);
      const available = HEADROOM + 600_000;

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(50_000_000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(RUNWAY_MINUTES_AT_TARGET);
      cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(available, { headroom: HEADROOM, minDeposit: MIN_DEPOSIT }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      const [, messages] = managedSignerService.executeDerivedTx.mock.calls[0];
      expect(messages[0].value.deposit?.amount?.amount).toBe("600000");
      expect(fundDrainingInstrumentation.recordHeadroomConceded).not.toHaveBeenCalled();
    });

    it("holds the balance headroom when yielding it would not make the deposit worth making either", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(50_000_000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(DEDUP_COOLDOWN_IN_MIN - 1);
      cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(HEADROOM + 600_000, { headroom: HEADROOM, minDeposit: MIN_DEPOSIT }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordHeadroomConceded).not.toHaveBeenCalled();
      expect(fundDrainingInstrumentation.recordDepositBelowUsefulRunway).toHaveBeenCalledWith(
        expect.objectContaining({ dseq: deployment.dseq, affordableAmount: 600_000 })
      );
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("releases the claim of a deposit it declined so credits landing later can fund it", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, deploymentSettingRepository } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(DEDUP_COOLDOWN_IN_MIN - 1);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.releaseFundingClaim).toHaveBeenCalledWith([createFundingClaim(deployment.id)]);
    });

    it("deposits a small amount the allowance covers in full, as a deployment close to its runtime limit asks for", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(DEDUP_COOLDOWN_IN_MIN - 1);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordDepositBelowUsefulRunway).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledOnce();
    });

    it("deposits a credit-capped amount that still buys more runway than the dedup cooldown", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(DEDUP_COOLDOWN_IN_MIN);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordDepositBelowUsefulRunway).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledOnce();
    });

    it("reports an exhausted allowance as insufficient balance rather than as a declined deposit", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, fundDrainingInstrumentation } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployment = createDrainingFor(owner, walletId);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([deployment]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(0);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 0));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(fundDrainingInstrumentation.recordDepositBelowUsefulRunway).not.toHaveBeenCalled();
      expect(fundDrainingInstrumentation.recordMessagePreparationError).toHaveBeenCalledWith(
        expect.objectContaining({ deployment, error: expect.objectContaining({ message: expect.stringContaining("Insufficient balance") }) })
      );
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });

    it("leaves the allowance of a declined deposit to the other deployments in the batch", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const declined = createDrainingFor(owner, walletId);
      const funded = createDrainingFor(owner, walletId);
      const ALLOWANCE = 1000;
      const NO_HEADROOM = 0;

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue([declined, funded]);
      drainingDeploymentService.calculateAmountToTargetRunway.mockImplementation(deployment => (deployment === declined ? ALLOWANCE * 5 : ALLOWANCE));
      drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockImplementation(deployment =>
        deployment === declined ? DEDUP_COOLDOWN_IN_MIN - 1 : RUNWAY_MINUTES_AT_TARGET
      );
      cachedBalanceService.getFresh.mockResolvedValue(new CachedBalance(ALLOWANCE, { headroom: NO_HEADROOM, minDeposit: MIN_DEPOSIT }));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      const [, messages] = managedSignerService.executeDerivedTx.mock.calls[0];
      expect(messages).toHaveLength(1);
      expect(messages[0].value.id?.xid).toBe(`${funded.address}/${funded.dseq}`);
      expect(messages[0].value.deposit?.amount?.amount).toBe(String(ALLOWANCE));
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

      expect(deploymentSettingRepository.claimForFunding).toHaveBeenCalledWith(
        expect.arrayContaining([won.id, claimedByAnotherPass.id]),
        DEDUP_COOLDOWN_IN_MIN
      );
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

  describe("when the chain reports a deployment closed", () => {
    it("marks the closed deployment, drops it, and funds the rest of the batch in the same pass", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation, owner, walletId, deployments } =
        setupDrainingOwner({ deploymentCount: 3 });
      const error = createDeploymentClosedError(1);

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(1);
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(error);

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(expect.objectContaining({ ok: true }));

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(managedSignerService.executeDerivedTx).toHaveBeenLastCalledWith(walletId, [
        expect.objectContaining({ value: expect.objectContaining({ id: { scope: Scope.deployment, xid: `${owner}/${deployments[0].dseq}` } }) }),
        expect.objectContaining({ value: expect.objectContaining({ id: { scope: Scope.deployment, xid: `${owner}/${deployments[2].dseq}` } }) })
      ]);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([deployments[1].id]);
      expect(instrumentation.recordDeploymentClosedOnChain).toHaveBeenCalledWith({
        owner,
        deployment: expect.objectContaining({ id: deployments[1].id }),
        messageIndex: 1,
        error
      });
      expect(instrumentation.recordChainTxError).not.toHaveBeenCalled();
      expect(instrumentation.recordDeposit.mock.calls[0][0].items).toHaveLength(2);
      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
    });

    it("resolves each retry's message index against the shrunken batch rather than the original one", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation, deployments } = setupDrainingOwner({
        deploymentCount: 4
      });

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValueOnce(0).mockReturnValueOnce(1);
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(createDeploymentClosedError(0)).mockRejectedValueOnce(createDeploymentClosedError(1));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenNthCalledWith(1, [deployments[0].id]);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenNthCalledWith(2, [deployments[2].id]);
      expect(instrumentation.recordDeposit.mock.calls[0][0].items.map(item => item.deployment.id)).toEqual([deployments[1].id, deployments[3].id]);
    });

    it("marks every deployment closed and reports no error when the whole batch is closed", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation, deployments } = setupDrainingOwner({
        deploymentCount: 2
      });

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(0);
      managedSignerService.executeDerivedTx.mockRejectedValue(createDeploymentClosedError(0));

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(expect.objectContaining({ ok: true }));

      expect(deploymentSettingRepository.markAsClosed).toHaveBeenNthCalledWith(1, [deployments[0].id]);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenNthCalledWith(2, [deployments[1].id]);
      expect(instrumentation.recordDeposit).not.toHaveBeenCalled();
      expect(instrumentation.recordChainTxError).not.toHaveBeenCalled();
      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
    });

    it("drops a deployment a broadcast tx reverted on rather than only a rejected estimate", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation, deployments } = setupDrainingOwner({
        deploymentCount: 2
      });

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(0);
      managedSignerService.executeDerivedTx.mockResolvedValueOnce(
        mock<IndexedTx>({ code: 8, hash: "tx-hash", rawLog: "failed to execute message; message index: 0: Deployment closed" })
      );

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([deployments[0].id]);
      expect(instrumentation.recordChainTxError).not.toHaveBeenCalled();
    });

    it("reports a chain tx error and marks nothing when the failing message cannot be located in the batch", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation } = setupDrainingOwner({
        deploymentCount: 2
      });
      const error = createDeploymentClosedError(7);

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(7);
      managedSignerService.executeDerivedTx.mockRejectedValue(error);

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
      expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
      expect(instrumentation.recordDeploymentClosedOnChain).not.toHaveBeenCalled();
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ error }));
    });

    it("keeps funding the rest of the batch when the closed deployment cannot be written to the database", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation, owner, deployments } = setupDrainingOwner({
        deploymentCount: 2
      });
      const markError = new Error("connection terminated");

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(0);
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(createDeploymentClosedError(0));
      deploymentSettingRepository.markAsClosed.mockRejectedValue(markError);

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(expect.objectContaining({ ok: true }));

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(2);
      expect(instrumentation.recordDeploymentCloseMarkFailed).toHaveBeenCalledWith({
        owner,
        deployment: expect.objectContaining({ id: deployments[0].id }),
        error: markError
      });
      expect(instrumentation.recordDeploymentClosedOnChain).not.toHaveBeenCalled();
      expect(instrumentation.recordChainTxError).not.toHaveBeenCalled();
    });

    it("stops retrying once too many deployments of one owner turn out closed, without reporting an error", async () => {
      const { service, chainErrorService, managedSignerService, deploymentSettingRepository, instrumentation, owner } = setupDrainingOwner({
        deploymentCount: 6
      });

      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(0);
      managedSignerService.executeDerivedTx.mockRejectedValue(createDeploymentClosedError(0));

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(expect.objectContaining({ ok: true }));

      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(3);
      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledTimes(3);
      expect(instrumentation.recordClosedDeploymentRetryLimit).toHaveBeenCalledWith({ owner, remainingCount: 3 });
      expect(instrumentation.recordChainTxError).not.toHaveBeenCalled();
    });

    it("reports a fee grant refill failure as a chain tx error", async () => {
      const { service, chainErrorService, managedSignerService, instrumentation, owner } = setupDrainingOwner({ deploymentCount: 2 });
      const error = new Error("fee grant refill failed");

      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);
      managedSignerService.ensureFeeGrants.mockRejectedValue(error);

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(expect.objectContaining({ ok: true }));

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ owner, error }));
      expect(instrumentation.recordMasterWalletInsufficientFundsError).not.toHaveBeenCalled();
    });

    it("reports master wallet insufficient funds when the fee grant refill drains the master wallet", async () => {
      const { service, chainErrorService, managedSignerService, instrumentation, owner } = setupDrainingOwner({ deploymentCount: 2 });
      const error = new Error("insufficient funds: 10uakt is smaller than 20uakt");

      chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(true);
      managedSignerService.ensureFeeGrants.mockRejectedValue(error);

      await expect(service.topUpDeployments({ dryRun: false })).resolves.toEqual(expect.objectContaining({ err: true, val: [error] }));

      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ owner, error }));
      expect(instrumentation.recordMasterWalletInsufficientFundsError).toHaveBeenCalledWith(expect.objectContaining({ owner, error }));
    });

    it("neither broadcasts nor marks anything closed on a dry run", async () => {
      const { service, managedSignerService, deploymentSettingRepository } = setupDrainingOwner({ deploymentCount: 2 });

      await service.topUpDeployments({ dryRun: true });

      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.markAsClosed).not.toHaveBeenCalled();
    });

    it("reports to the event-driven instrumentation when immediate funding hits a closed deployment", async () => {
      const {
        service,
        chainErrorService,
        drainingDeploymentService,
        cachedBalanceService,
        managedSignerService,
        deploymentSettingRepository,
        instrumentation,
        fundDrainingInstrumentation
      } = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployments = createDrainingDeployments(owner, walletId, 2);

      drainingDeploymentService.findDrainingDeploymentsForOwner.mockResolvedValue(deployments);
      drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      cachedBalanceService.getFresh.mockResolvedValue(createMockCachedBalance(() => 1000000));
      chainErrorService.isDeploymentClosedError.mockReturnValue(true);
      chainErrorService.getFailedMessageIndex.mockReturnValue(0);
      managedSignerService.executeDerivedTx.mockRejectedValueOnce(createDeploymentClosedError(0));

      await service.topUpDrainingDeploymentsForOwner({ walletId, address: owner });

      expect(deploymentSettingRepository.markAsClosed).toHaveBeenCalledWith([deployments[0].id]);
      expect(fundDrainingInstrumentation.recordDeploymentClosedOnChain).toHaveBeenCalledWith(expect.objectContaining({ owner, messageIndex: 0 }));
      expect(instrumentation.recordDeploymentClosedOnChain).not.toHaveBeenCalled();
    });

    function setupDrainingOwner(input: { deploymentCount: number }) {
      const context = setup();
      const owner = createAkashAddress();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployments = createDrainingDeployments(owner, walletId, input.deploymentCount);

      mockOwnerYields(context.drainingDeploymentService, createOwnerYield(deployments));
      context.drainingDeploymentService.calculateAmountToTargetRunway.mockReturnValue(1000000);
      context.cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 1000000));

      return { ...context, owner, walletId, deployments };
    }
  });

  function createDeploymentClosedError(messageIndex: number) {
    const error: Error & { originalError?: Error } = new Error("Deployment closed");
    error.originalError = new Error(
      `Query failed with (6): rpc error: code = Unknown desc = failed to execute message; message index: ${messageIndex}: Deployment closed`
    );
    return error;
  }

  function createDrainingDeployments(owner: string, walletId: number, count: number): DrainingDeployment[] {
    return Array.from({ length: count }, () => {
      const setting = createAutoTopUpDeployment({ address: owner, walletId });
      return {
        ...setting,
        ...createDrainingDeployment({
          dseq: Number(setting.dseq),
          owner,
          predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500,
          denom: DEPLOYMENT_GRANT_DENOM
        }),
        dseq: setting.dseq
      } as DrainingDeployment;
    });
  }

  function setupWithWalletReloadJobs(input?: { currentBlockHeight?: number; feeAllowance?: number }) {
    const walletSettingRepository = mock<WalletSettingRepository>();
    const userWalletRepository = mock<UserWalletRepository>();
    const jobQueueService = mock<JobQueueService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    jobQueueService.enqueue.mockResolvedValue(faker.string.uuid());
    const walletReloadService = new WalletReloadJobService(walletSettingRepository, userWalletRepository, jobQueueService, createLogger);

    return {
      ...setup({ ...input, walletReloadService }),
      walletSettingRepository,
      userWalletRepository,
      jobQueueService,
      logger
    };
  }

  function setup(input?: { currentBlockHeight?: number; feeAllowance?: number; walletReloadService?: WalletReloadJobService }) {
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
    drainingDeploymentService.calculateRunwayMinutesAfterDeposit.mockReturnValue(RUNWAY_MINUTES_AT_TARGET);
    const rpcMessageService = new RpcMessageService(billingConfig);
    const cachedBalanceService = mock<CachedBalanceService>();
    const blockHttpService = mock<BlockHttpService>();
    blockHttpService.getCurrentHeight.mockResolvedValue(currentBlockHeight);
    const chainErrorService = mock<ChainErrorService>();
    chainErrorService.isMasterWalletInsufficientFundsError.mockResolvedValue(false);
    const instrumentation = mock<TopUpManagedDeploymentsInstrumentationService>();
    const fundDrainingInstrumentation = mock<FundDrainingDeploymentsInstrumentationService>();
    const walletReloadService = input?.walletReloadService ?? mock<WalletReloadJobService>();
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.claimForFunding.mockImplementation(async (ids: string[]) => ids.map(createFundingClaim));
    deploymentSettingRepository.releaseFundingClaim.mockResolvedValue(undefined);
    deploymentSettingRepository.markAsClosed.mockResolvedValue(undefined);
    deploymentSettingRepository.findAutoTopUpDeploymentsByOwnerIteratively.mockImplementation(() => (async function* () {})());
    const deploymentConfig = mockConfigService<DeploymentConfigService>({ AUTO_TOP_UP_DEDUP_COOLDOWN_IN_MIN: DEDUP_COOLDOWN_IN_MIN });
    const balancesService = mock<BalancesService>();

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
      deploymentConfig,
      balancesService
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
      deploymentConfig,
      balancesService
    };
  }
});
