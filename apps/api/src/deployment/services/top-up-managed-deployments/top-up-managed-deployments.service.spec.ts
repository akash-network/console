import "@test/mocks/logger-service.mock";

import { faker } from "@faker-js/faker";

import { RpcMessageService, Wallet } from "@src/billing/services";
import { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import { BlockHttpService } from "@src/chain/services/block-http/block-http.service";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { CachedBalanceService } from "../cached-balance/cached-balance.service";
import { TopUpManagedDeploymentsService } from "./top-up-managed-deployments.service";

import { MockConfigService } from "@test/mocks/config-service.mock";
import { AkashAddressSeeder } from "@test/seeders/akash-address.seeder";
import { AutoTopUpDeploymentSeeder } from "@test/seeders/auto-top-up-deployment.seeder";
import { DrainingDeploymentSeeder } from "@test/seeders/draining-deployment.seeder";

jest.mock("@akashnetwork/logging");

describe(TopUpManagedDeploymentsService.name, () => {
  let managedSignerService: jest.Mocked<ManagedSignerService>;
  let billingConfig: MockConfigService<{ DEPLOYMENT_GRANT_DENOM: string }>;
  let drainingDeploymentService: jest.Mocked<DrainingDeploymentService>;
  let managedMasterWallet: jest.Mocked<Wallet>;
  let rpcMessageService: RpcMessageService;
  let cachedBalanceService: jest.Mocked<CachedBalanceService>;
  let blockHttpService: jest.Mocked<BlockHttpService>;
  let service: TopUpManagedDeploymentsService;

  const MANAGED_MASTER_WALLET_ADDRESS = AkashAddressSeeder.create();
  const DEPLOYMENT_GRANT_DENOM = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
  const CURRENT_BLOCK_HEIGHT = 7481457;

  beforeEach(() => {
    managedSignerService = {
      executeManagedTx: jest.fn()
    } as Partial<jest.Mocked<ManagedSignerService>> as jest.Mocked<ManagedSignerService>;

    billingConfig = new MockConfigService<{ DEPLOYMENT_GRANT_DENOM: string }>({
      DEPLOYMENT_GRANT_DENOM
    });

    drainingDeploymentService = {
      paginate: jest.fn(),
      calculateTopUpAmount: jest.fn()
    } as Partial<jest.Mocked<DrainingDeploymentService>> as jest.Mocked<DrainingDeploymentService>;

    managedMasterWallet = {
      getFirstAddress: jest.fn().mockResolvedValue(MANAGED_MASTER_WALLET_ADDRESS)
    } as Partial<jest.Mocked<Wallet>> as jest.Mocked<Wallet>;

    rpcMessageService = new RpcMessageService();

    cachedBalanceService = {
      get: jest.fn()
    } as Partial<jest.Mocked<CachedBalanceService>> as jest.Mocked<CachedBalanceService>;

    blockHttpService = {
      getCurrentHeight: jest.fn().mockResolvedValue(CURRENT_BLOCK_HEIGHT)
    } as Partial<jest.Mocked<BlockHttpService>> as jest.Mocked<BlockHttpService>;

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
              predictedClosedHeight: index === 0 ? predictedClosedHeight1 : predictedClosedHeight2
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
      deployments.forEach(deployment => {
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
      });
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
  });
});
