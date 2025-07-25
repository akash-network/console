import "@test/mocks/logger-service.mock";

import { mock } from "jest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { UserWalletRepository } from "@src/billing/repositories";
import type { RpcMessageService } from "@src/billing/services";
import type { ManagedUserWalletService } from "@src/billing/services";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { BlockRepository } from "@src/chain/repositories/block.repository";
import type { ErrorService } from "@src/core/services/error/error.service";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import { averageBlockCountInAnHour } from "@src/utils/constants";
import { TrialDeploymentsCleanerService } from "./trial-deployments-cleaner.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { StaleDeploymentSeeder } from "@test/seeders/stale-deployment.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(TrialDeploymentsCleanerService.name, () => {
  const CURRENT_BLOCK_HEIGHT = 7481457;
  const TRIAL_DEPLOYMENT_CLEANUP_HOURS = 24;

  describe("cleanup", () => {
    const CONCURRENCY = 10;
    const CUTOFF_HEIGHT = CURRENT_BLOCK_HEIGHT - Math.floor(TRIAL_DEPLOYMENT_CLEANUP_HOURS * averageBlockCountInAnHour);

    it("should cleanup trial deployments for trial users", async () => {
      const trialWallets = [
        UserWalletSeeder.create({
          address: createAkashAddress(),
          isTrialing: true
        }),
        UserWalletSeeder.create({
          address: createAkashAddress(),
          isTrialing: true
        })
      ];

      const staleDeployments1 = [StaleDeploymentSeeder.create({ dseq: 123456 }), StaleDeploymentSeeder.create({ dseq: 123457 })];

      const staleDeployments2 = [StaleDeploymentSeeder.create({ dseq: 123458 })];

      const closeMessages1 = [
        { type: "close", dseq: "123456" },
        { type: "close", dseq: "123457" }
      ];

      const closeMessages2 = [{ type: "close", dseq: "123458" }];

      const { service, userWalletRepository, deploymentRepository, blockRepository, rpcMessageService, managedSignerService } = setup({
        trialWallets,
        concurrency: CONCURRENCY,
        getCloseDeploymentMsgMock: jest
          .fn()
          .mockReturnValueOnce(closeMessages1[0])
          .mockReturnValueOnce(closeMessages1[1])
          .mockReturnValueOnce(closeMessages2[0]),
        findDeploymentsBeforeCutoffMock: jest.fn().mockResolvedValueOnce(staleDeployments1).mockResolvedValueOnce(staleDeployments2)
      });

      await service.cleanup({ concurrency: CONCURRENCY });

      expect(blockRepository.getLatestHeight).toHaveBeenCalled();
      expect(userWalletRepository.paginate).toHaveBeenCalledWith(
        {
          query: { isTrialing: true },
          limit: CONCURRENCY
        },
        expect.any(Function)
      );

      expect(deploymentRepository.findDeploymentsBeforeCutoff).toHaveBeenCalledWith({
        owner: trialWallets[0].address,
        cutoffHeight: CUTOFF_HEIGHT
      });
      expect(deploymentRepository.findDeploymentsBeforeCutoff).toHaveBeenCalledWith({
        owner: trialWallets[1].address,
        cutoffHeight: CUTOFF_HEIGHT
      });

      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(trialWallets[0].address, staleDeployments1[0].dseq);
      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(trialWallets[0].address, staleDeployments1[1].dseq);
      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(trialWallets[1].address, staleDeployments2[0].dseq);

      expect(managedSignerService.executeManagedTx).toHaveBeenCalledWith(trialWallets[0].id, closeMessages1);
      expect(managedSignerService.executeManagedTx).toHaveBeenCalledWith(trialWallets[1].id, closeMessages2);
    });

    it("should not process wallets with no stale deployments", async () => {
      const trialWallets = [
        UserWalletSeeder.create({
          address: createAkashAddress(),
          isTrialing: true
        })
      ];

      const { service, deploymentRepository, rpcMessageService, managedSignerService } = setup({
        trialWallets,
        concurrency: CONCURRENCY,
        getCloseDeploymentMsgMock: jest.fn(),
        findDeploymentsBeforeCutoffMock: jest.fn().mockResolvedValue([])
      });

      await service.cleanup({ concurrency: CONCURRENCY });

      expect(deploymentRepository.findDeploymentsBeforeCutoff).toHaveBeenCalledWith({
        owner: trialWallets[0].address,
        cutoffHeight: CUTOFF_HEIGHT
      });

      // Should not call RPC message service or managed signer service
      expect(rpcMessageService.getCloseDeploymentMsg).not.toHaveBeenCalled();
      expect(managedSignerService.executeManagedTx).not.toHaveBeenCalled();
    });

    it("should handle fee authorization errors and retry", async () => {
      const trialWallet = UserWalletSeeder.create({
        address: createAkashAddress(),
        isTrialing: true
      });

      const staleDeployments = [StaleDeploymentSeeder.create({ dseq: 123456 })];

      const closeMessage = { type: "close", dseq: "123456" };

      const { service, managedSignerService, managedUserWalletService, config } = setup({
        trialWallets: [trialWallet],
        concurrency: CONCURRENCY,
        feeError: true,
        getCloseDeploymentMsgMock: jest.fn().mockReturnValue(closeMessage),
        findDeploymentsBeforeCutoffMock: jest.fn().mockResolvedValue(staleDeployments)
      });

      await service.cleanup({ concurrency: CONCURRENCY });

      expect(managedSignerService.executeManagedTx).toHaveBeenCalledTimes(2);
      expect(managedUserWalletService.authorizeSpending).toHaveBeenCalledWith({
        address: trialWallet.address,
        limits: {
          fees: config.FEE_ALLOWANCE_REFILL_AMOUNT
        }
      });
    });

    it("should use default concurrency when none provided", async () => {
      const trialWallets = [
        UserWalletSeeder.create({
          address: createAkashAddress(),
          isTrialing: true
        })
      ];

      const { service, userWalletRepository } = setup({
        trialWallets,
        concurrency: 10,
        findDeploymentsBeforeCutoffMock: jest.fn().mockResolvedValue([])
      });

      await service.cleanup({});

      expect(userWalletRepository.paginate).toHaveBeenCalledWith(
        {
          query: { isTrialing: true },
          limit: 10
        },
        expect.any(Function)
      );
    });

    it("should handle non-fee errors and throw them", async () => {
      const trialWallet = UserWalletSeeder.create({
        address: createAkashAddress(),
        isTrialing: true
      });

      const staleDeployments = [StaleDeploymentSeeder.create({ dseq: 123456 })];

      const closeMessage = { type: "close", dseq: "123456" };

      const { service, managedSignerService, managedUserWalletService } = setup({
        trialWallets: [trialWallet],
        concurrency: CONCURRENCY,
        networkError: true,
        getCloseDeploymentMsgMock: jest.fn().mockReturnValue(closeMessage),
        findDeploymentsBeforeCutoffMock: jest.fn().mockResolvedValue(staleDeployments)
      });

      await service.cleanup({ concurrency: CONCURRENCY });

      expect(managedSignerService.executeManagedTx).toHaveBeenCalledTimes(1);
      expect(managedUserWalletService.authorizeSpending).not.toHaveBeenCalled();
    });

    function setup(input: {
      trialWallets: any[];
      concurrency?: number;
      feeError?: boolean;
      networkError?: boolean;
      getCloseDeploymentMsgMock?: jest.Mock;
      findDeploymentsBeforeCutoffMock?: jest.Mock;
    }) {
      const userWalletRepository = mock<UserWalletRepository>({
        paginate: jest.fn()
      });

      const deploymentRepository = mock<DeploymentRepository>({
        findDeploymentsBeforeCutoff: input.findDeploymentsBeforeCutoffMock || jest.fn()
      });

      const blockRepository = mock<BlockRepository>({
        getLatestHeight: jest.fn().mockResolvedValue(CURRENT_BLOCK_HEIGHT)
      });

      const rpcMessageService = mock<RpcMessageService>({
        getCloseDeploymentMsg: input.getCloseDeploymentMsgMock || jest.fn()
      });

      const managedSignerService = mock<ManagedSignerService>({
        executeManagedTx: jest.fn()
      });

      const managedUserWalletService = mock<ManagedUserWalletService>({
        authorizeSpending: jest.fn()
      });

      const errorService = mock<ErrorService>({
        execWithErrorHandler: jest.fn()
      });

      const config = mock<BillingConfig>({
        TRIAL_DEPLOYMENT_CLEANUP_HOURS,
        FEE_ALLOWANCE_REFILL_AMOUNT: 1000000
      });

      const service = new TrialDeploymentsCleanerService(
        userWalletRepository,
        deploymentRepository,
        blockRepository,
        rpcMessageService,
        managedSignerService,
        config,
        managedUserWalletService,
        errorService
      );

      (userWalletRepository.paginate as jest.Mock).mockImplementation(async (params, callback) => {
        expect(params.query.isTrialing).toBe(true);
        expect(params.limit).toBe(input.concurrency || 10);
        await callback(input.trialWallets);
      });

      if (input.feeError) {
        (managedSignerService.executeManagedTx as jest.Mock).mockRejectedValueOnce(new Error("not allowed to pay fees")).mockResolvedValueOnce(undefined);
      } else if (input.networkError) {
        const networkError = new Error("Network timeout");
        (managedSignerService.executeManagedTx as jest.Mock).mockRejectedValue(networkError);
      } else {
        (managedSignerService.executeManagedTx as jest.Mock).mockResolvedValue(undefined);
      }

      (managedUserWalletService.authorizeSpending as jest.Mock).mockResolvedValue(undefined);

      (errorService.execWithErrorHandler as jest.Mock).mockImplementation(async (params, cleanupFn) => {
        expect(params.wallet).toBeDefined();
        expect(params.event).toBe("TRIAL_DEPLOYMENT_CLEANUP_ERROR");
        expect(params.context).toBe(TrialDeploymentsCleanerService.name);

        if (input.networkError) {
          await expect(cleanupFn()).rejects.toThrow("Network timeout");
        } else {
          await cleanupFn();
        }
      });

      return {
        service,
        userWalletRepository,
        deploymentRepository,
        blockRepository,
        rpcMessageService,
        managedSignerService,
        managedUserWalletService,
        errorService,
        config
      };
    }
  });
});
