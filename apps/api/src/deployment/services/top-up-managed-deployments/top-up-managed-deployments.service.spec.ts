import "@test/mocks/logger-service.mock";

import { LoggerService } from "@akashnetwork/logging";
import { faker } from "@faker-js/faker";

import type { Wallet } from "@src/billing/services";
import { RpcMessageService } from "@src/billing/services";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import type { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import type { CachedBalanceService } from "../cached-balance/cached-balance.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { MockConfigService } from "@test/mocks/config-service.mock";
import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";
import { stub } from "@test/services/stub";

jest.mock("@akashnetwork/logging", () => ({
  LoggerService: {
    forContext: jest.fn().mockReturnValue({
      info: jest.fn(),
      error: jest.fn()
    })
  }
}));

describe(TopUpManagedDeploymentsService.name, () => {
  let managedSignerService: jest.Mocked<ManagedSignerService>;
  let billingConfig: MockConfigService<{ DEPLOYMENT_GRANT_DENOM: string }>;
  let drainingDeploymentService: jest.Mocked<DrainingDeploymentService>;
  let managedMasterWallet: jest.Mocked<Wallet>;
  let rpcMessageService: RpcMessageService;
  let cachedBalanceService: jest.Mocked<CachedBalanceService>;
  let blockHttpService: jest.Mocked<BlockHttpService>;
  let service: TopUpManagedDeploymentsService;
  let logger: jest.Mocked<LoggerService>;

  const MANAGED_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const DEPLOYMENT_GRANT_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
  const CURRENT_BLOCK_HEIGHT = 7481457;

  beforeEach(() => {
    managedSignerService = stub<ManagedSignerService>({ executeManagedTx: jest.fn() });
    billingConfig = new MockConfigService<{ DEPLOYMENT_GRANT_DENOM: string }>({
      DEPLOYMENT_GRANT_DENOM
    });
    drainingDeploymentService = stub<DrainingDeploymentService>({
      paginate: jest.fn(),
      calculateTopUpAmount: jest.fn()
    });
    managedMasterWallet = stub<Wallet>({ getFirstAddress: jest.fn().mockResolvedValue(MANAGED_MASTER_WALLET_ADDRESS) });
    rpcMessageService = new RpcMessageService();
    cachedBalanceService = stub<CachedBalanceService>({ get: jest.fn() });
    blockHttpService = stub<BlockHttpService>({ getCurrentHeight: jest.fn().mockResolvedValue(CURRENT_BLOCK_HEIGHT) });
    logger = (LoggerService.forContext as jest.Mock)() as jest.Mocked<LoggerService>;

    service = new TopUpManagedDeploymentsService(
      managedSignerService,
      billingConfig,
      drainingDeploymentService,
      managedMasterWallet,
      rpcMessageService,
      cachedBalanceService,
      blockHttpService
    );
  });

  describe("topUpDeployments", () => {
    it("should top up draining deployments", async () => {
      const deployments = AutoTopUpDeploymentSeeder.createMany(2);
      const desiredAmount = faker.number.int({ min: 3500000, max: 4000000 });
      const sufficientAmount = faker.number.int({ min: 1000000, max: 2000000 });
      const predictedClosedHeight1 = CURRENT_BLOCK_HEIGHT + 1500;
      const predictedClosedHeight2 = CURRENT_BLOCK_HEIGHT + 1700;

      (drainingDeploymentService.paginate as jest.Mock).mockImplementation(async (_, callback) => {
        await callback(
          deployments.map((deployment, index) => ({
            ...deployment,
            ...DrainingDeploymentSeeder.create({
              dseq: Number(deployment.dseq),
              owner: deployment.address,
              predictedClosedHeight: index === 0 ? predictedClosedHeight1 : predictedClosedHeight2,
              denom: DEPLOYMENT_GRANT_DENOM
            })
          }))
        );
      });

      (drainingDeploymentService.calculateTopUpAmount as jest.Mock).mockResolvedValue(desiredAmount);
      (cachedBalanceService.get as jest.Mock).mockImplementation(async () => ({
        reserveSufficientAmount: () => sufficientAmount
      }));

      await service.topUpDeployments({ concurrency: 10, dryRun: false });

      expect(managedSignerService.executeManagedTx).toHaveBeenCalledTimes(deployments.length);
      deployments.forEach((deployment, index) => {
        expect(managedSignerService.executeManagedTx).toHaveBeenCalledWith(deployment.walletId, [
          {
            typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment",
            value: {
              id: {
                owner: deployment.address,
                dseq: { high: 0, low: Number(deployment.dseq), unsigned: true }
              },
              amount: {
                denom: DEPLOYMENT_GRANT_DENOM,
                amount: sufficientAmount.toString()
              },
              depositor: MANAGED_MASTER_WALLET_ADDRESS
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
                  dseq: Number(deployment.dseq),
                  id: deployment.id,
                  owner: deployment.address,
                  address: deployment.address,
                  predictedClosedHeight: index === 0 ? predictedClosedHeight1 : predictedClosedHeight2,
                  walletId: deployment.walletId
                }),
                input: expect.objectContaining({
                  amount: sufficientAmount,
                  denom: DEPLOYMENT_GRANT_DENOM,
                  depositor: MANAGED_MASTER_WALLET_ADDRESS,
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
      const deployments = AutoTopUpDeploymentSeeder.createMany(2);
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      (drainingDeploymentService.paginate as jest.Mock).mockImplementation(async (_, callback) => {
        await callback(
          deployments.map(deployment => ({
            ...deployment,
            ...DrainingDeploymentSeeder.create({
              dseq: Number(deployment.dseq),
              owner: deployment.address,
              predictedClosedHeight
            })
          }))
        );
      });

      (drainingDeploymentService.calculateTopUpAmount as jest.Mock)
        .mockResolvedValueOnce(1000000)
        .mockRejectedValueOnce(new Error("Failed to calculate amount"));

      (cachedBalanceService.get as jest.Mock).mockImplementation(async () => ({
        reserveSufficientAmount: () => 500000
      }));

      await service.topUpDeployments({ concurrency: 10, dryRun: false });

      expect(managedSignerService.executeManagedTx).toHaveBeenCalledTimes(1);
    });

    it("should not execute transactions in dry run mode", async () => {
      const deployments = AutoTopUpDeploymentSeeder.createMany(2);
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      (drainingDeploymentService.paginate as jest.Mock).mockImplementation(async (_, callback) => {
        await callback(
          deployments.map(deployment => ({
            ...deployment,
            ...DrainingDeploymentSeeder.create({
              dseq: Number(deployment.dseq),
              owner: deployment.address,
              predictedClosedHeight
            })
          }))
        );
      });

      (drainingDeploymentService.calculateTopUpAmount as jest.Mock).mockResolvedValue(1000000);
      (cachedBalanceService.get as jest.Mock).mockImplementation(async () => ({
        reserveSufficientAmount: () => 500000
      }));

      await service.topUpDeployments({ concurrency: 10, dryRun: true });

      expect(managedSignerService.executeManagedTx).not.toHaveBeenCalled();
    });

    it("should not execute transactions if no draining deployments", async () => {
      (drainingDeploymentService.paginate as jest.Mock).mockImplementation(async (_, callback) => {
        await callback([]);
      });

      await service.topUpDeployments({ concurrency: 10, dryRun: false });

      expect(managedSignerService.executeManagedTx).not.toHaveBeenCalled();
    });

    it("should top up draining deployments for the same owner in the same tx", async () => {
      const owner = AkashAddressSeeder.create();
      const walletId = faker.number.int({ min: 1000000, max: 9999999 });
      const deployments = [AutoTopUpDeploymentSeeder.create({ address: owner, walletId }), AutoTopUpDeploymentSeeder.create({ address: owner, walletId })];
      const desiredAmount = faker.number.int({ min: 3500000, max: 4000000 });
      const sufficientAmount = faker.number.int({ min: 1000000, max: 2000000 });
      const predictedClosedHeight = CURRENT_BLOCK_HEIGHT + 1500;

      (drainingDeploymentService.paginate as jest.Mock).mockImplementation(async (_, callback) => {
        await callback(
          deployments.map(deployment => ({
            ...deployment,
            ...DrainingDeploymentSeeder.create({
              dseq: Number(deployment.dseq),
              owner: deployment.address,
              predictedClosedHeight
            })
          }))
        );
      });

      (drainingDeploymentService.calculateTopUpAmount as jest.Mock).mockResolvedValue(desiredAmount);
      (cachedBalanceService.get as jest.Mock).mockImplementation(async () => ({
        reserveSufficientAmount: () => sufficientAmount
      }));

      await service.topUpDeployments({ concurrency: 10, dryRun: false });

      expect(managedSignerService.executeManagedTx).toHaveBeenCalledTimes(1);
      expect(managedSignerService.executeManagedTx).toHaveBeenCalledWith(walletId, [
        {
          typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment",
          value: {
            id: {
              owner: owner,
              dseq: { high: 0, low: Number(deployments[0].dseq), unsigned: true }
            },
            amount: {
              denom: DEPLOYMENT_GRANT_DENOM,
              amount: sufficientAmount.toString()
            },
            depositor: MANAGED_MASTER_WALLET_ADDRESS
          }
        },
        {
          typeUrl: "/akash.deployment.v1beta3.MsgDepositDeployment",
          value: {
            id: {
              owner: owner,
              dseq: { high: 0, low: Number(deployments[1].dseq), unsigned: true }
            },
            amount: {
              denom: DEPLOYMENT_GRANT_DENOM,
              amount: sufficientAmount.toString()
            },
            depositor: MANAGED_MASTER_WALLET_ADDRESS
          }
        }
      ]);
    });

    it("should log errors when message preparation fails", async () => {
      const deployment = AutoTopUpDeploymentSeeder.create();
      const error = new Error("Failed to calculate amount");

      (drainingDeploymentService.paginate as jest.Mock).mockImplementation(async (_, callback) => {
        await callback([
          {
            ...deployment,
            ...DrainingDeploymentSeeder.create({
              dseq: Number(deployment.dseq),
              owner: deployment.address,
              predictedClosedHeight: CURRENT_BLOCK_HEIGHT + 1500
            })
          }
        ]);
      });

      (drainingDeploymentService.calculateTopUpAmount as jest.Mock).mockRejectedValue(error);

      await service.topUpDeployments({ concurrency: 10, dryRun: false });

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
  });
});
