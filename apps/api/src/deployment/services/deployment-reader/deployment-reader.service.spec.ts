import "@test/mocks/logger-service.mock";

import type { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { WalletInitialized } from "@src/billing/repositories";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LoggerService } from "@src/core/providers/logging.provider";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
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
  describe("findByUserIdAndDseq", () => {
    it("returns what the console recorded alongside the deployment", async () => {
      const { service, wallet } = setup({ recorded: { sdl: "version: '2.0'", manifestVersion: "BAUG" } });

      const result = await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(result.consoleSettings).toEqual({ sdl: "version: '2.0'", manifestVersion: "BAUG" });
    });

    it("returns no console settings when nothing was recorded for the deployment", async () => {
      const { service, wallet } = setup({ recorded: null });

      const result = await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(result.consoleSettings).toBeNull();
    });

    it("returns no console settings for a settings row that carries no sdl", async () => {
      const { service, wallet } = setup({ recorded: { sdl: null, manifestVersion: null } });

      const result = await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(result.consoleSettings).toBeNull();
    });

    it("reads the console settings under the caller's own ability and user id", async () => {
      const { service, wallet, deploymentSettingRepository, scopedDeploymentSettingRepository, authService } = setup();

      await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedDeploymentSettingRepository.findOneBy).toHaveBeenCalledWith({ userId: wallet.userId, dseq: "12345" });
    });

    it("reads the console settings without waiting for the chain to answer", async () => {
      const { service, wallet, deploymentHttpService, scopedDeploymentSettingRepository } = setup();
      const deploymentInfo = createDeploymentInfoSeed();
      let settingsWereReadBeforeTheChainAnswered = false;

      deploymentHttpService.findByOwnerAndDseq.mockImplementation(async () => {
        await Promise.resolve();
        settingsWereReadBeforeTheChainAnswered = scopedDeploymentSettingRepository.findOneBy.mock.calls.length > 0;
        return deploymentInfo;
      });

      await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(settingsWereReadBeforeTheChainAnswered).toBe(true);
    });
  });

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

    it.each(["closed", "insufficient_funds"])("does not ask the provider for the status of a %s lease", async state => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const lease = createLeaseApiResponse({ owner: wallet.address, dseq, state });
      const { service, providerService } = setup({ leases: [lease] });

      await service.findByWalletAndDseq(wallet, dseq);

      expect(providerService.getLeaseStatus).not.toHaveBeenCalled();
      expect(providerService.toProviderAuth).not.toHaveBeenCalled();
    });

    it("still returns a closed lease, with a null status", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const lease = createLeaseApiResponse({ owner: wallet.address, dseq, state: "closed" });
      const { service } = setup({ leases: [lease] });

      const result = await service.findByWalletAndDseq(wallet, dseq);

      expect(result.leases).toHaveLength(1);
      expect(result.leases[0]).toMatchObject({ state: "closed", status: null });
    });

    it.each(["active", "reclaiming"])("asks the provider for the status of a %s lease", async state => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const lease = createLeaseApiResponse({ owner: wallet.address, dseq, state });
      const { service, providerService } = setup({ leases: [lease] });

      await service.findByWalletAndDseq(wallet, dseq);

      expect(providerService.getLeaseStatus).toHaveBeenCalledWith(
        lease.lease.id.provider,
        lease.lease.id.dseq,
        lease.lease.id.gseq,
        lease.lease.id.oseq,
        expect.anything()
      );
    });

    it("returns every lease but only probes the live one", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const activeLease = createLeaseApiResponse({ owner: wallet.address, dseq, state: "active" });
      const leases = [
        activeLease,
        createLeaseApiResponse({ owner: wallet.address, dseq, state: "closed" }),
        createLeaseApiResponse({ owner: wallet.address, dseq, state: "insufficient_funds" })
      ];
      const { service, providerService } = setup({ leases });

      const result = await service.findByWalletAndDseq(wallet, dseq);

      expect(result.leases).toHaveLength(3);
      expect(providerService.getLeaseStatus).toHaveBeenCalledTimes(1);
      expect(providerService.getLeaseStatus).toHaveBeenCalledWith(
        activeLease.lease.id.provider,
        activeLease.lease.id.dseq,
        activeLease.lease.id.gseq,
        activeLease.lease.id.oseq,
        expect.anything()
      );
    });

    it("reports a null status and logs a warning when a live lease's provider fails", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const dseq = "12345";
      const lease = createLeaseApiResponse({ owner: wallet.address, dseq, state: "active" });
      const { service, providerService, logger } = setup({ leases: [lease] });

      providerService.getLeaseStatus.mockRejectedValue(createHttpError(503));

      const result = await service.findByWalletAndDseq(wallet, dseq);

      expect(result.leases[0]).toMatchObject({ status: null });
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "LEASE_STATUS_FETCH_FAILED",
          provider: lease.lease.id.provider,
          dseq: lease.lease.id.dseq,
          leaseState: "active"
        })
      );
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
      leases?: ReturnType<typeof createLeaseApiResponse>[];
      recorded?: Pick<DeploymentSettingsOutput, "sdl" | "manifestVersion"> | null;
    } = {}
  ) {
    const defaultWallet = createUserWallet() as WalletInitialized;
    const wallet = input.wallet ?? defaultWallet;
    const defaultDeploymentInfo = createDeploymentInfoSeed();
    const defaultDeploymentList = createDeploymentListResponseSeed({}, 0);

    const mocks = {
      providerService: mock<ProviderService>({
        getLeaseStatus: vi.fn().mockResolvedValue(null),
        toProviderAuth: vi.fn().mockResolvedValue({ type: "jwt", token: "test" })
      }),
      deploymentHttpService: mock<DeploymentHttpService>({
        findByOwnerAndDseq: vi.fn().mockResolvedValue(defaultDeploymentInfo),
        findAll: vi.fn().mockResolvedValue(defaultDeploymentList)
      }),
      fallbackDeploymentReaderService: mock<FallbackDeploymentReaderService>({
        findByOwnerAndDseq: vi.fn().mockResolvedValue(input.fallbackDeploymentInfo ?? defaultDeploymentInfo),
        findAll: vi.fn().mockResolvedValue(input.fallbackDeploymentList ?? defaultDeploymentList)
      }),
      leaseHttpService: mock<LeaseHttpService>({
        list: vi.fn().mockResolvedValue({ leases: input.leases ?? [], pagination: { next_key: null, total: String(input.leases?.length ?? 0) } })
      }),
      fallbackLeaseReaderService: mock<FallbackLeaseReaderService>({
        list: vi.fn().mockResolvedValue({
          leases: input.fallbackLeases ?? [],
          pagination: { next_key: null, total: "0" }
        })
      }),
      messageService: mock<MessageService>(),
      walletReaderService: mock<WalletReaderService>({
        getWalletByUserId: vi.fn().mockResolvedValue(wallet)
      }),
      logger: mock<LoggerService>()
    };

    const recorded = input.recorded === undefined ? { sdl: "version: '2.0'", manifestVersion: "BAUG" } : input.recorded;
    const scopedDeploymentSettingRepository = mock<DeploymentSettingRepository>({
      findOneBy: vi.fn().mockResolvedValue(recorded ? mock<DeploymentSettingsOutput>(recorded) : undefined)
    });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      accessibleBy: vi.fn().mockReturnValue(scopedDeploymentSettingRepository)
    });
    const authService = mock<AuthService>({ ability: mock<AuthService["ability"]>() });

    const service = new DeploymentReaderService(
      mocks.providerService,
      mocks.deploymentHttpService,
      mocks.fallbackDeploymentReaderService,
      mocks.leaseHttpService,
      mocks.fallbackLeaseReaderService,
      mocks.messageService,
      mocks.walletReaderService,
      deploymentSettingRepository,
      authService,
      mocks.logger
    );

    return { service, ...mocks, wallet, deploymentSettingRepository, scopedDeploymentSettingRepository, authService };
  }
});
