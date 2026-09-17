import type { DeploymentHttpService, LeaseHttpService } from "@akashnetwork/http-sdk";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { WalletInitialized } from "@src/billing/repositories";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentRepository } from "@src/deployment/repositories/deployment/deployment.repository";
import type {
  DeploymentSettingRepository,
  DeploymentSettingsOutput,
  ListedDeploymentSetting
} from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { FallbackDeploymentReaderService } from "@src/deployment/services/fallback-deployment-reader/fallback-deployment-reader.service";
import type { FallbackLeaseReaderService } from "@src/deployment/services/fallback-lease-reader/fallback-lease-reader.service";
import type { MessageService } from "@src/deployment/services/message-service/message.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { DeploymentReaderService } from "./deployment-reader.service";

import { createDeploymentInfoGroupSeed, createDeploymentInfoSeed } from "@test/seeders/deployment-info.seeder";
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

    it("returns the name the console recorded for the deployment", async () => {
      const { service, wallet } = setup({ recorded: { sdl: "version: '2.0'", manifestVersion: "BAUG", name: "web" } });

      const result = await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(result.name).toBe("web");
    });

    it("returns no name when nothing was recorded for the deployment", async () => {
      const { service, wallet } = setup({ recorded: null });

      const result = await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(result.name).toBeNull();
    });

    it("returns the name of a deployment whose sdl was never recorded, which reports no console settings at all", async () => {
      const { service, wallet } = setup({ recorded: { sdl: null, manifestVersion: null, name: "renamed" } });

      const result = await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(result).toMatchObject({ name: "renamed", consoleSettings: null });
    });

    it("reads the name and the console settings from a single settings read", async () => {
      const { service, wallet, scopedDeploymentSettingRepository } = setup();

      await service.findByUserIdAndDseq(wallet.userId, "12345");

      expect(scopedDeploymentSettingRepository.findOneBy).toHaveBeenCalledTimes(1);
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
    it("returns each deployment's name, and null for one the console never named", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: ["100", "200"], settings: { "100": { name: "web" } } });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments).toMatchObject([{ name: "web" }, { name: null }]);
    });

    it("looks the settings up once for the whole page, under the caller's own ability and user id", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentSettingRepository, scopedDeploymentSettingRepository, authService } = setup({
        wallet,
        listedDseqs: ["100", "200"]
      });

      await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedDeploymentSettingRepository.findListedSettings).toHaveBeenCalledTimes(1);
      expect(scopedDeploymentSettingRepository.findListedSettings).toHaveBeenCalledWith({ userId: wallet.userId, dseqs: ["100", "200"] });
    });

    it("gives each listed deployment the leases fetched for that deployment alone", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, leaseHttpService } = setup({ wallet, listedDseqs: ["100", "200"] });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments.map(item => item.leases.map(lease => lease.id.dseq))).toEqual([["100"], ["200"]]);
      expect(leaseHttpService.list).toHaveBeenCalledWith({ owner: wallet.address, dseq: "100" });
      expect(leaseHttpService.list).toHaveBeenCalledWith({ owner: wallet.address, dseq: "200" });
    });

    it("fails the list rather than reporting a deployment whose lease fetch failed as lease-less", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, leaseHttpService } = setup({ wallet, listedDseqs: ["100", "200"] });
      leaseHttpService.list.mockRejectedValue(createHttpError(400));

      await expect(service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 })).rejects.toThrow();
    });

    it("falls back to database for lease data when blockchain node is unreachable", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, leaseHttpService, fallbackLeaseReaderService } = setup({ wallet, listedDseqs: ["100"] });
      leaseHttpService.list.mockRejectedValue(createNetworkError("ECONNREFUSED"));
      fallbackLeaseReaderService.list.mockResolvedValue({
        leases: [createLeaseApiResponse({ owner: wallet.address, dseq: "100" })],
        pagination: { next_key: null, total: "1" }
      });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(fallbackLeaseReaderService.list).toHaveBeenCalledWith({ owner: wallet.address, dseq: "100" });
      expect(deployments.map(item => item.leases.map(lease => lease.id.dseq))).toEqual([["100"]]);
    });

    it("reads no settings for a page with no deployments on it", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, scopedDeploymentSettingRepository } = setup({ wallet, listedDseqs: [] });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments).toEqual([]);
      expect(scopedDeploymentSettingRepository.findListedSettings).not.toHaveBeenCalled();
    });

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

    it("reports another page when the chain hands back a cursor to one", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: ["100"], nextKey: "cursor" });

      const { hasMore } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 1 });

      expect(hasMore).toBe(true);
    });

    it("reports no further page when the chain hands back no cursor, whatever its total claims", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: ["100"], chainTotal: "99" });

      const { hasMore } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 1 });

      expect(hasMore).toBe(false);
    });

    it("counts the owner's deployments in the requested state through the chain index", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentRepository } = setup({ wallet, listedDseqs: ["100"], deploymentCount: 42 });

      const { total } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 1 });

      expect(total).toBe(42);
      expect(deploymentRepository.countByOwnerAndState).toHaveBeenCalledWith(wallet.address, "active");
    });

    it("never counts fewer deployments than the page it is answering with", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: ["100", "200"], deploymentCount: 0 });

      const { total } = await service.list({ query: { userId: wallet.userId }, skip: 10, limit: 10 });

      expect(total).toBe(12);
    });

    it("does not let a page past the end inflate the count", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: [], deploymentCount: 3 });

      const { total } = await service.list({ query: { userId: wallet.userId }, skip: 1000000, limit: 10 });

      expect(total).toBe(3);
    });

    it("answers with the page the chain gave when the console's index cannot be counted", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentRepository, logger } = setup({ wallet, listedDseqs: ["100", "200"] });
      deploymentRepository.countByOwnerAndState.mockRejectedValue(new Error("chain index unavailable"));

      const { deployments, hasMore } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments).toHaveLength(2);
      expect(hasMore).toBe(false);
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_COUNT_FAILED" }));
    });

    it("reports the count as unknown rather than guessing when the console's index cannot be counted", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentRepository } = setup({ wallet, listedDseqs: ["100", "200"] });
      deploymentRepository.countByOwnerAndState.mockRejectedValue(new Error("chain index unavailable"));

      const { total } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(total).toBeNull();
    });

    it("returns what the console holds about each listed deployment", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const runtimeEndsAt = new Date("2026-09-20T10:00:00.000Z");
      const { service } = setup({
        wallet,
        listedDseqs: ["100"],
        settings: { "100": { name: "web", closed: false, runtimeLimitHours: 5, runtimeEndsAt } }
      });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments[0].settings).toEqual({
        name: "web",
        closed: false,
        runtimeLimitHours: 5,
        runtimeEndsAt: "2026-09-20T10:00:00.000Z"
      });
    });

    it("returns no settings for a deployment the console holds no row for", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: ["100"] });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments[0].settings).toBeNull();
    });

    it("returns no runtime end for a deployment whose limit was never anchored", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service } = setup({ wallet, listedDseqs: ["100"], settings: { "100": { runtimeLimitHours: 5, runtimeEndsAt: null } } });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments[0].settings).toMatchObject({ runtimeLimitHours: 5, runtimeEndsAt: null });
    });

    it("asks the chain for the state the caller named", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentHttpService } = setup({ wallet, listedDseqs: ["100"] });

      await service.list({ query: { userId: wallet.userId }, state: "closed", skip: 0, limit: 10 });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith(expect.objectContaining({ owner: wallet.address, state: "closed" }));
    });

    it("counts the state the caller named rather than the default", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentRepository } = setup({ wallet, listedDseqs: ["100"] });

      await service.list({ query: { userId: wallet.userId }, state: "closed", skip: 0, limit: 10 });

      expect(deploymentRepository.countByOwnerAndState).toHaveBeenCalledWith(wallet.address, "closed");
    });

    it("asks the chain for the newest deployments first when the caller reverses the order", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentHttpService } = setup({ wallet, listedDseqs: ["100"] });

      await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10, reverse: true });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith(expect.objectContaining({ pagination: expect.objectContaining({ reverse: true }) }));
    });

    it("leaves the chain's own order alone when the caller does not reverse it", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentHttpService } = setup({ wallet, listedDseqs: ["100"] });

      await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deploymentHttpService.findAll).toHaveBeenCalledWith(expect.objectContaining({ pagination: expect.objectContaining({ reverse: false }) }));
    });

    it("forwards the state and the order to the database it falls back to", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const { service, deploymentHttpService, fallbackDeploymentReaderService } = setup({ wallet, listedDseqs: ["100"] });
      deploymentHttpService.findAll.mockRejectedValue(createNetworkError("ECONNRESET"));

      await service.list({ query: { userId: wallet.userId }, state: "closed", skip: 0, limit: 10, reverse: true });

      expect(fallbackDeploymentReaderService.findAll).toHaveBeenCalledWith(expect.objectContaining({ state: "closed", reverse: true }));
    });

    it("returns the resource groups the chain described for each deployment", async () => {
      const wallet = createUserWallet() as WalletInitialized;
      const groups = [createDeploymentInfoGroupSeed({ owner: wallet.address, dseq: "100" })];
      const { service } = setup({ wallet, listedDseqs: ["100"], listedGroups: groups });

      const { deployments } = await service.list({ query: { userId: wallet.userId }, skip: 0, limit: 10 });

      expect(deployments[0].groups).toEqual(groups);
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

  describe("findNames", () => {
    it("answers every dseq asked about, with null for one the console never recorded", async () => {
      const { service, wallet } = setup({ names: { "100": "web" } });

      const names = await service.findNames(wallet.userId, ["100", "200"]);

      expect(names).toEqual({ "100": "web", "200": null });
    });

    it("answers null for a deployment the console recorded unnamed", async () => {
      const { service, wallet } = setup({ names: { "100": null } });

      const names = await service.findNames(wallet.userId, ["100"]);

      expect(names).toEqual({ "100": null });
    });

    it("looks the names up once, under the caller's own ability and user id", async () => {
      const { service, wallet, deploymentSettingRepository, scopedDeploymentSettingRepository, authService } = setup({ names: { "100": "web" } });

      await service.findNames(wallet.userId, ["100", "200"]);

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedDeploymentSettingRepository.findNamesByDseqs).toHaveBeenCalledExactlyOnceWith({ userId: wallet.userId, dseqs: ["100", "200"] });
    });

    it("reads nothing when asked about no deployment", async () => {
      const { service, wallet, scopedDeploymentSettingRepository } = setup();

      const names = await service.findNames(wallet.userId, []);

      expect(names).toEqual({});
      expect(scopedDeploymentSettingRepository.findNamesByDseqs).not.toHaveBeenCalled();
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

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DeploymentReaderService.name });
  });

  function setup(
    input: {
      wallet?: WalletInitialized;
      fallbackDeploymentInfo?: ReturnType<typeof createDeploymentInfoSeed>;
      fallbackDeploymentList?: ReturnType<typeof createDeploymentListResponseSeed>;
      fallbackLeases?: ReturnType<typeof createLeaseApiResponse>[];
      leases?: ReturnType<typeof createLeaseApiResponse>[];
      recorded?: (Pick<DeploymentSettingsOutput, "sdl" | "manifestVersion"> & { name?: string | null }) | null;
      listedDseqs?: string[];
      names?: Record<string, string | null>;
      settings?: Record<string, Partial<ListedDeploymentSetting>>;
      listedGroups?: ReturnType<typeof createDeploymentInfoGroupSeed>[];
      nextKey?: string | null;
      chainTotal?: string;
      deploymentCount?: number;
    } = {}
  ) {
    const defaultWallet = createUserWallet() as WalletInitialized;
    const wallet = input.wallet ?? defaultWallet;
    const defaultDeploymentInfo = createDeploymentInfoSeed();
    const defaultDeploymentList = input.listedDseqs
      ? {
          deployments: input.listedDseqs.map(dseq => createDeploymentInfoSeed({ owner: wallet.address, dseq, groups: input.listedGroups })),
          pagination: { next_key: input.nextKey ?? null, total: input.chainTotal ?? String(input.listedDseqs.length) }
        }
      : createDeploymentListResponseSeed({}, 0);

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
        list: input.listedDseqs
          ? vi.fn().mockImplementation(async ({ dseq }: { dseq?: string }) => ({
              leases: dseq ? [createLeaseApiResponse({ owner: wallet.address, dseq })] : [],
              pagination: { next_key: null, total: dseq ? "1" : "0" }
            }))
          : vi.fn().mockResolvedValue({ leases: input.leases ?? [], pagination: { next_key: null, total: String(input.leases?.length ?? 0) } })
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
      logger: mock<ReturnType<CreateLogger>>()
    };

    const recorded = input.recorded === undefined ? { sdl: "version: '2.0'", manifestVersion: "BAUG", name: null } : input.recorded;
    const scopedDeploymentSettingRepository = mock<DeploymentSettingRepository>({
      findOneBy: vi.fn().mockResolvedValue(recorded ? mock<DeploymentSettingsOutput>({ ...recorded, name: recorded.name ?? null }) : undefined),
      findNamesByDseqs: vi.fn().mockResolvedValue(new Map(Object.entries(input.names ?? {}))),
      findListedSettings: vi
        .fn()
        .mockResolvedValue(
          new Map(
            Object.entries(input.settings ?? {}).map(([dseq, setting]) => [
              dseq,
              { name: null, closed: false, runtimeLimitHours: null, runtimeEndsAt: null, ...setting }
            ])
          )
        )
    });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({
      accessibleBy: vi.fn().mockReturnValue(scopedDeploymentSettingRepository)
    });
    const deploymentRepository = mock<DeploymentRepository>({
      countByOwnerAndState: vi.fn().mockResolvedValue(input.deploymentCount ?? input.listedDseqs?.length ?? 0)
    });
    const authService = mock<AuthService>({ ability: mock<AuthService["ability"]>() });
    const createLogger = vi.fn<CreateLogger>(() => mocks.logger);

    const service = new DeploymentReaderService(
      mocks.providerService,
      mocks.deploymentHttpService,
      mocks.fallbackDeploymentReaderService,
      mocks.leaseHttpService,
      mocks.fallbackLeaseReaderService,
      mocks.messageService,
      mocks.walletReaderService,
      deploymentSettingRepository,
      deploymentRepository,
      authService,
      createLogger
    );

    return { service, createLogger, ...mocks, wallet, deploymentSettingRepository, scopedDeploymentSettingRepository, deploymentRepository, authService };
  }
});
