import "@test/mocks/logger-service.mock";

import type { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { AxiosError } from "axios";
import { mock } from "vitest-mock-extended";

import type { WalletInitialized, WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { FallbackDeploymentReaderService } from "@src/deployment/services/fallback-deployment-reader/fallback-deployment-reader.service";
import type { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import type { MessageService } from "@src/deployment/services/message-service/message.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "./deployment-reader.service";

import { DeploymentInfoSeeder } from "@test/seeders/deployment-info.seeder";
import { DeploymentListResponseSeeder } from "@test/seeders/deployment-list-response.seeder";
import { LeaseApiResponseSeeder } from "@test/seeders/lease-api-response.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

describe(DeploymentReaderService.name, () => {
  describe("findByWalletAndDseq", () => {
    it("falls back to database for deployment data when blockchain node is unreachable", async () => {
      const wallet = UserWalletSeeder.create() as WalletInitialized;
      const dseq = "12345";
      const deploymentInfo = DeploymentInfoSeeder.create({ owner: wallet.address, dseq });
      const { service, deploymentHttpService, fallbackDeploymentReaderService } = setup({
        fallbackDeploymentInfo: deploymentInfo
      });

      deploymentHttpService.findByOwnerAndDseq.mockRejectedValue(createNetworkError("ECONNRESET"));
      await service.findByWalletAndDseq(wallet, dseq);

      expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(wallet.address, dseq);
      expect(fallbackDeploymentReaderService.findByOwnerAndDseq).toHaveBeenCalledWith(wallet.address, dseq);
    });

    it("falls back to database for lease data when blockchain node is unreachable", async () => {
      const wallet = UserWalletSeeder.create() as WalletInitialized;
      const dseq = "12345";
      const deploymentInfo = DeploymentInfoSeeder.create({ owner: wallet.address, dseq });
      const lease = LeaseApiResponseSeeder.create({ owner: wallet.address, dseq, state: "active" });
      const { service, leaseHttpService, fallbackLeaseReaderService } = setup({
        fallbackDeploymentInfo: deploymentInfo,
        fallbackLeases: [lease]
      });

      leaseHttpService.list.mockRejectedValue(createNetworkError("ECONNRESET"));

      await service.findByWalletAndDseq(wallet, dseq);

      expect(leaseHttpService.list).toHaveBeenCalledWith({ owner: wallet.address, dseq });
      expect(fallbackLeaseReaderService.list).toHaveBeenCalledWith({ owner: wallet.address, dseq });
    });

    it("does not fall back to database for non-network errors", async () => {
      const wallet = UserWalletSeeder.create() as WalletInitialized;
      const dseq = "12345";
      const { service, fallbackDeploymentReaderService, deploymentHttpService } = setup();

      deploymentHttpService.findByOwnerAndDseq.mockRejectedValue(createHttpError(400));
      await expect(service.findByWalletAndDseq(wallet, dseq)).rejects.toThrow();
      expect(fallbackDeploymentReaderService.findByOwnerAndDseq).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("falls back to database when blockchain node is unreachable", async () => {
      const wallet = UserWalletSeeder.create() as WalletInitialized;
      const deploymentList = DeploymentListResponseSeeder.create({}, 2);
      const { service, deploymentHttpService, fallbackDeploymentReaderService } = setup({
        wallet,
        fallbackDeploymentList: deploymentList
      });

      deploymentHttpService.findAll.mockRejectedValue(createNetworkError("ECONNRESET"));
      await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deploymentHttpService.findAll).toHaveBeenCalled();
      expect(fallbackDeploymentReaderService.findAll).toHaveBeenCalled();
    });
  });

  function createNetworkError(code: string): AxiosError {
    const error = new AxiosError(code);
    error.code = code;
    return error;
  }

  function createHttpError(status: number): AxiosError {
    return new AxiosError("HTTP Error", undefined, undefined, undefined, {
      status,
      data: {},
      statusText: "Error",
      headers: {},
      config: {} as any
    });
  }

  function setup(
    input: {
      wallet?: WalletInitialized;
      fallbackDeploymentInfo?: ReturnType<typeof DeploymentInfoSeeder.create>;
      fallbackDeploymentList?: ReturnType<typeof DeploymentListResponseSeeder.create>;
      fallbackLeases?: ReturnType<typeof LeaseApiResponseSeeder.create>[];
    } = {}
  ) {
    const defaultWallet = UserWalletSeeder.create() as WalletInitialized;
    const wallet = input.wallet ?? defaultWallet;
    const defaultDeploymentInfo = DeploymentInfoSeeder.create();
    const defaultDeploymentList = DeploymentListResponseSeeder.create({}, 0);

    const mocks = {
      providerService: mock<ProviderService>({
        getLeaseStatus: jest.fn().mockResolvedValue(null),
        toProviderAuth: jest.fn().mockResolvedValue({ type: "jwt", token: "test" })
      }),
      deploymentHttpService: mock<DeploymentHttpService>({
        findByOwnerAndDseq: jest.fn().mockResolvedValue(defaultDeploymentInfo),
        findAll: jest.fn().mockResolvedValue(defaultDeploymentList)
      }),
      fallbackDeploymentReaderService: mock<FallbackDeploymentReaderService>({
        findByOwnerAndDseq: jest.fn().mockResolvedValue(input.fallbackDeploymentInfo ?? defaultDeploymentInfo),
        findAll: jest.fn().mockResolvedValue(input.fallbackDeploymentList ?? defaultDeploymentList)
      }),
      leaseHttpService: mock<LeaseHttpService>({
        list: jest.fn().mockResolvedValue({ leases: [], pagination: { next_key: null, total: "0" } })
      }),
      fallbackLeaseReaderService: mock<FallbackLeaseReaderService>({
        list: jest.fn().mockResolvedValue({
          leases: input.fallbackLeases ?? [],
          pagination: { next_key: null, total: "0" }
        })
      }),
      messageService: mock<MessageService>(),
      walletReaderService: mock<WalletReaderService>({
        getWalletByUserId: jest.fn().mockResolvedValue(wallet)
      }),
      logger: mock<LoggerService>()
    };

    const service = new DeploymentReaderService(
      mocks.providerService,
      mocks.deploymentHttpService,
      mocks.fallbackDeploymentReaderService,
      mocks.leaseHttpService,
      mocks.fallbackLeaseReaderService,
      mocks.messageService,
      mocks.walletReaderService,
      mocks.logger
    );

    return { service, ...mocks };
  }
});
