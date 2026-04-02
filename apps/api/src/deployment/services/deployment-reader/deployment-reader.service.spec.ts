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

import { createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
import { createDeploymentListResponseSeed } from "@test/seeders/deployment-list-response.seeder";
import { createLeaseApiResponse } from "@test/seeders/lease-api-response.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentReaderService.name, () => {
  describe("findByWalletAndDseq", () => {
    it("falls back to database for deployment data when blockchain node is unreachable", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const deploymentInfo = createDeploymentInfoSeed({ owner: wallet.address, dseq });
      const { service, deploymentHttpService, fallbackDeploymentReaderService } = setup({
        fallbackDeploymentInfo: deploymentInfo
      });

      deploymentHttpService.findByOwnerAndDseq.mockRejectedValue(createNetworkError("ECONNRESET"));
      await service.findByWalletAndDseq(wallet, dseq);

      expect(deploymentHttpService.findByOwnerAndDseq).toHaveBeenCalledWith(wallet.address, dseq);
      expect(fallbackDeploymentReaderService.findByOwnerAndDseq).toHaveBeenCalledWith(wallet.address, dseq);
    });

    it("falls back to database for lease data when blockchain node is unreachable", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const deploymentInfo = createDeploymentInfoSeed({ owner: wallet.address, dseq });
      const lease = createLeaseApiResponse({ owner: wallet.address, dseq, state: "active" });
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
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const { service, fallbackDeploymentReaderService, deploymentHttpService } = setup();

      deploymentHttpService.findByOwnerAndDseq.mockRejectedValue(createHttpError(400));
      await expect(service.findByWalletAndDseq(wallet, dseq)).rejects.toThrow();
      expect(fallbackDeploymentReaderService.findByOwnerAndDseq).not.toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("falls back to database when blockchain node is unreachable", async () => {
      const deploymentList = createDeploymentListResponseSeed({}, 2);
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentHttpService, fallbackDeploymentReaderService } = setup({
        wallet,
        fallbackDeploymentList: deploymentList
      });

      deploymentHttpService.findAll.mockRejectedValue(createNetworkError("ECONNRESET"));
      await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deploymentHttpService.findAll).toHaveBeenCalled();
      expect(fallbackDeploymentReaderService.findAll).toHaveBeenCalled();
    });

    it("forwards pagination as flat skip/limit when falling back to database", async () => {
      const deploymentList = createDeploymentListResponseSeed({}, 2);
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentHttpService, fallbackDeploymentReaderService } = setup({
        wallet,
        fallbackDeploymentList: deploymentList
      });

      deploymentHttpService.findAll.mockRejectedValue(createNetworkError("ECONNRESET"));
      await service.list({ query: { userId: wallet.userId }, skip: 25, limit: 50 });

      expect(fallbackDeploymentReaderService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: wallet.address,
          state: "active",
          skip: 25,
          limit: 50
        })
      );
    });
  });

  describe("listWithResources", () => {
    it("passes status as state with offset pagination when skip is provided", async () => {
      const address = "akash1abc";
      const { service, deploymentHttpService } = setup();

      await service.listWithResources({ address, skip: 10, limit: 100, status: "active" });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: address,
          state: "active",
          pagination: expect.objectContaining({ offset: 10 })
        })
      );
    });

    it("passes status as state with offset pagination when status is closed", async () => {
      const address = "akash1abc";
      const { service, deploymentHttpService } = setup();

      await service.listWithResources({ address, skip: 0, limit: 50, status: "closed" });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: address,
          state: "closed",
          pagination: expect.objectContaining({ offset: 0 })
        })
      );
    });

    it("passes status as state without offset when skip is not provided", async () => {
      const address = "akash1abc";
      const { service, deploymentHttpService } = setup();

      await service.listWithResources({ address, status: "active" });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: address,
          state: "active"
        })
      );
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
      fallbackDeploymentInfo?: ReturnType<typeof createDeploymentInfoSeed>;
      fallbackDeploymentList?: ReturnType<typeof createDeploymentListResponseSeed>;
      fallbackLeases?: ReturnType<typeof createLeaseApiResponse>[];
    } = {}
  ) {
    const defaultWallet = createUserWallet() as WalletInitialized;
    const wallet = input.wallet ?? defaultWallet;
    const defaultDeploymentInfo = createDeploymentInfoSeed();
    const defaultDeploymentList = createDeploymentListResponseSeed({}, 0);

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
