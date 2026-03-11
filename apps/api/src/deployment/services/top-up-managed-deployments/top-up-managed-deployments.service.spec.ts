import "@test/mocks/logger-service.mock";

import { Scope, Source } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { IndexedTx } from "@cosmjs/stargate";
import { faker } from "@faker-js/faker";
import { mock } from "vitest-mock-extended";

import { RpcMessageService } from "@src/billing/services";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ChainErrorService } from "@src/billing/services/chain-error/chain-error.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DrainingDeployment, DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { mockConfigService } from "../../../../test/mocks/config-service.mock";
import type { CachedBalance, CachedBalanceService } from "../cached-balance/cached-balance.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";
import type { TopUpManagedDeploymentsInstrumentationService } from "./top-up-managed-deployments-instrumentation.service";

import { createAkashAddress } from "@test/seeders";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";

describe(TopUpManagedDeploymentsService.name, () => {
  const DEPLOYMENT_GRANT_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const SUFFICIENT_FEE_ALLOWANCE = 100001;

  function createMockCachedBalance(reserveSufficientAmount: (desiredAmount: number) => number) {
    const balance = mock<CachedBalance>();
    balance.reserveSufficientAmount.mockImplementation(reserveSufficientAmount);
    return balance;
  }

  describe("topUpDeployments", () => {
    it("should top up draining deployments", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, instrumentation } = setup();
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
      const { service, drainingDeploymentService, instrumentation } = setup();
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
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(instrumentation.recordMasterWalletInsufficientFundsError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(instrumentation.finish).toHaveBeenCalledWith("failure", CURRENT_BLOCK_HEIGHT);
    });

    it("should handle user wallet insufficient funds error and continue processing", async () => {
      const { service, chainErrorService, managedSignerService, drainingDeploymentService, cachedBalanceService, instrumentation } = setup();
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
      expect(instrumentation.recordChainTxError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(instrumentation.finish).toHaveBeenCalledWith("success", CURRENT_BLOCK_HEIGHT);
    });

    it("should call ensureFeeGrants before executing top-up", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService } = setup();
      const deployment = AutoTopUpDeploymentSeeder.create();
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          yield {
            address: deployment.address,
            deployments: [
              {
                ...deployment,
                ...DrainingDeploymentSeeder.create({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
                dseq: deployment.dseq
              } as DrainingDeployment
            ]
          };
        })()
      );
      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: false });

      expect(managedSignerService.ensureFeeGrants).toHaveBeenCalledWith({
        address: deployment.address,
        isTrialing: deployment.walletIsTrialing,
        createdAt: deployment.walletCreatedAt
      });
      expect(managedSignerService.executeDerivedTx).toHaveBeenCalledTimes(1);
    });

    it("should not execute top-up when fee grant is missing and cannot be refilled", async () => {
      const { service, drainingDeploymentService, cachedBalanceService, managedSignerService, instrumentation } = setup({ feeAllowance: 0 });
      const deployment = AutoTopUpDeploymentSeeder.create();
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          yield {
            address: deployment.address,
            deployments: [
              {
                ...deployment,
                ...DrainingDeploymentSeeder.create({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
                dseq: deployment.dseq
              } as DrainingDeployment
            ]
          };
        })()
      );
      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(1000000);
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
      const deployment = AutoTopUpDeploymentSeeder.create();
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      drainingDeploymentService.findDrainingDeploymentsByOwner.mockImplementation(() =>
        (async function* () {
          yield {
            address: deployment.address,
            deployments: [
              {
                ...deployment,
                ...DrainingDeploymentSeeder.create({ dseq: Number(deployment.dseq), owner: deployment.address, predictedClosedHeight }),
                dseq: deployment.dseq
              } as DrainingDeployment
            ]
          };
        })()
      );
      drainingDeploymentService.calculateTopUpAmount.mockResolvedValue(1000000);
      cachedBalanceService.get.mockResolvedValue(createMockCachedBalance(() => 500000));

      await service.topUpDeployments({ dryRun: true });

      expect(managedSignerService.ensureFeeGrants).not.toHaveBeenCalled();
      expect(managedSignerService.executeDerivedTx).not.toHaveBeenCalled();
    });
  });

  function setup(input?: { currentBlockHeight?: number; feeAllowance?: number }) {
    const currentBlockHeight = input?.currentBlockHeight ?? CURRENT_BLOCK_HEIGHT;
    const feeAllowance = input?.feeAllowance ?? SUFFICIENT_FEE_ALLOWANCE;

    const managedSignerService = mock<ManagedSignerService>();
    managedSignerService.ensureFeeGrants.mockResolvedValue(feeAllowance);
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
    const instrumentation = mock<TopUpManagedDeploymentsInstrumentationService>();

    const service = new TopUpManagedDeploymentsService(
      managedSignerService,
      billingConfig,
      drainingDeploymentService,
      rpcMessageService,
      cachedBalanceService,
      blockHttpService,
      chainErrorService,
      instrumentation
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
      instrumentation
    };
  }
});
