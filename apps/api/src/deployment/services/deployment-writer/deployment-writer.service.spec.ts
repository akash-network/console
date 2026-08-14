import { DeploymentReclamation, MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LoggerService } from "@src/core";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import type { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { DeploymentWriterService } from "./deployment-writer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(DeploymentWriterService.name, () => {
  const wallet: WalletInitialized = {
    id: 1,
    userId: "user-1",
    address: "akash1testaddr",
    creditAmount: 100,
    deploymentAllowance: 50,
    feeAllowance: 10
  } as WalletInitialized;

  const manifestValue = {
    groups: [{ name: "test-group" }],
    groupSpecs: [{ name: "test-group", resources: [] }]
  };

  const deploymentData: GetDeploymentResponse["data"] = {
    deployment: {
      id: { owner: wallet.address, dseq: "100" },
      state: "active",
      hash: Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"),
      created_at: "2026-01-01"
    },
    leases: [
      {
        id: { owner: wallet.address, dseq: "100", gseq: 1, oseq: 1, provider: "provider-1", bseq: 1 },
        state: "active",
        price: { denom: "uakt", amount: "1000" },
        created_at: "2026-01-01",
        closed_on: "",
        status: null
      }
    ],
    escrow_account: {
      id: { scope: "deployment", xid: "100" },
      state: {
        owner: wallet.address,
        state: "open",
        transferred: [],
        settled_at: "0",
        funds: [],
        deposits: []
      }
    }
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("create", () => {
    it("creates a deployment with a millisecond-timestamp dseq", async () => {
      const { service, signerService, rpcMessageService } = setup();
      const dseq = 1748400000000;
      vi.spyOn(Date, "now").mockReturnValue(dseq);
      const txResult = { code: 0, transactionHash: "tx-hash", hash: "tx-hash", rawLog: "" };
      signerService.executeDerivedDecodedTxByUserId.mockResolvedValue(txResult);
      const createMsg = { typeUrl: "/create", value: MsgCreateDeployment.fromPartial({}) };
      rpcMessageService.getCreateDeploymentMsg.mockReturnValue(createMsg);

      const result = await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(result.dseq).toBe("1748400000000");
      expect(result.signTx).toBe(txResult);
      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: wallet.address,
          dseq,
          groups: manifestValue.groupSpecs,
          denom: "uakt",
          amount: 5000000
        })
      );
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [createMsg]);
    });

    it("throws 400 when SDL is invalid", async () => {
      const { service, sdlService } = setup();
      sdlService.generateManifest.mockReturnValue({
        ok: false,
        value: [{ message: "invalid version" }]
      } as any);

      await expect(service.create({ userId: "user-1", sdl: "bad-sdl", deposit: 5 })).rejects.toThrow();
    });

    it("forwards the reclamation block to getCreateDeploymentMsg when the SDL declares it", async () => {
      const { service, sdlService, rpcMessageService } = setup();
      const reclamation = DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400 } });
      sdlService.generateManifest.mockReturnValue({ ok: true, value: { ...manifestValue, reclamation } } as any);

      await service.create({ userId: "user-1", sdl: "sdl-with-reclamation", deposit: 5 });

      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ reclamation }));
    });

    it("passes reclamation as undefined for an SDL without a reclamation block", async () => {
      const { service, rpcMessageService } = setup();

      await service.create({ userId: "user-1", sdl: "sdl-2.0", deposit: 5 });

      expect(rpcMessageService.getCreateDeploymentMsg.mock.calls[0][0].reclamation).toBeUndefined();
    });

    it("reclaims trial orphans with age 0 before signing the create when the wallet is trialing", async () => {
      const { service, staleDeploymentsCleaner, signerService, walletReaderService } = setup();
      walletReaderService.getWalletByUserId.mockResolvedValue({ ...wallet, isTrialing: true });

      await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(staleDeploymentsCleaner.cleanUpForWallet).toHaveBeenCalledWith(expect.objectContaining({ id: wallet.id, address: wallet.address }), 0);
      expect(staleDeploymentsCleaner.cleanUpForWallet.mock.invocationCallOrder[0]).toBeLessThan(
        signerService.executeDerivedDecodedTxByUserId.mock.invocationCallOrder[0]
      );
    });

    it("does not reclaim orphans for a non-trial create", async () => {
      const { service, staleDeploymentsCleaner } = setup();

      await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(staleDeploymentsCleaner.cleanUpForWallet).not.toHaveBeenCalled();
    });

    it("still creates the deployment when the orphan cleanup fails", async () => {
      const { service, staleDeploymentsCleaner, signerService, walletReaderService } = setup();
      walletReaderService.getWalletByUserId.mockResolvedValue({ ...wallet, isTrialing: true });
      staleDeploymentsCleaner.cleanUpForWallet.mockRejectedValue(new Error("cleanup boom"));

      const result = await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(result.dseq).toBeDefined();
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalled();
    });

    it("ignores the caller deposit and uses the configured default when managed deposit is enabled", async () => {
      const { service, rpcMessageService } = setup({ isManagedDepositEnabled: true, defaultDeposit: 0.5 });

      await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
    });

    it("creates a deployment without a caller deposit when managed deposit is enabled", async () => {
      const { service, rpcMessageService } = setup({ isManagedDepositEnabled: true, defaultDeposit: 0.5 });

      await service.create({ userId: "user-1", sdl: "valid-sdl" });

      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
    });

    it("throws 400 when managed deposit is disabled and no deposit is provided", async () => {
      const { service, rpcMessageService } = setup({ isManagedDepositEnabled: false });

      await expect(service.create({ userId: "user-1", sdl: "valid-sdl" })).rejects.toMatchObject({ status: 400 });
      expect(rpcMessageService.getCreateDeploymentMsg).not.toHaveBeenCalled();
    });
  });

  describe("closeByUserIdAndDseq", () => {
    it("fetches wallet and closes deployment", async () => {
      const { service, signerService, rpcMessageService } = setup();
      const closeMsg = { typeUrl: "/close", value: MsgCloseDeployment.fromPartial({}) };
      rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg);

      await service.closeByUserIdAndDseq("user-1", "100");

      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(wallet.address, "100");
      expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(wallet, [closeMsg]);
    });
  });

  describe("close", () => {
    it("closes deployment by wallet and dseq", async () => {
      const { service, signerService, rpcMessageService } = setup();
      const closeMsg = { typeUrl: "/close", value: MsgCloseDeployment.fromPartial({}) };
      rpcMessageService.getCloseDeploymentMsg.mockReturnValue(closeMsg);

      await service.close(wallet, "100");

      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(wallet.address, "100");
      expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(wallet, [closeMsg]);
    });

    it("does not broadcast a close tx when the deployment is already closed", async () => {
      const { service, signerService, rpcMessageService, deploymentReaderService } = setup();
      deploymentReaderService.findByWalletAndDseq.mockResolvedValue({
        ...deploymentData,
        deployment: { ...deploymentData.deployment, state: "closed" }
      });

      await service.close(wallet, "100");

      expect(rpcMessageService.getCloseDeploymentMsg).not.toHaveBeenCalled();
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("treats a failed close tx as success when a re-read shows the deployment already closed", async () => {
      const { service, signerService, deploymentReaderService } = setup();
      signerService.executeDecodedTxByUserWallet.mockRejectedValue(new Error("deployment already closed"));
      deploymentReaderService.findByWalletAndDseq
        .mockResolvedValueOnce(deploymentData)
        .mockResolvedValueOnce({ ...deploymentData, deployment: { ...deploymentData.deployment, state: "closed" } });

      await expect(service.close(wallet, "100")).resolves.toBeUndefined();
    });

    it("re-throws the original close error when a re-read shows the deployment is still open", async () => {
      const { service, signerService, deploymentReaderService } = setup();
      const closeError = new Error("close boom");
      signerService.executeDecodedTxByUserWallet.mockRejectedValue(closeError);
      deploymentReaderService.findByWalletAndDseq.mockResolvedValue(deploymentData);

      await expect(service.close(wallet, "100")).rejects.toBe(closeError);
    });

    it("re-throws the original close error when the post-failure re-read also fails", async () => {
      const { service, signerService, deploymentReaderService } = setup();
      const closeError = new Error("close boom");
      signerService.executeDecodedTxByUserWallet.mockRejectedValue(closeError);
      deploymentReaderService.findByWalletAndDseq.mockResolvedValueOnce(deploymentData).mockRejectedValueOnce(new Error("indexer unavailable"));

      await expect(service.close(wallet, "100")).rejects.toBe(closeError);
    });
  });

  describe("deposit", () => {
    it("deposits funds and returns updated deployment", async () => {
      const { service, rpcMessageService, signerService, deploymentReaderService } = setup();
      const updatedDeployment = { ...deploymentData };
      deploymentReaderService.findByWalletAndDseq.mockResolvedValue(updatedDeployment);
      const depositMsg = { typeUrl: "/deposit", value: MsgAccountDeposit.fromPartial({}) };
      rpcMessageService.getDepositDeploymentMsg.mockReturnValue(depositMsg);

      const result = await service.deposit({ userId: "user-1", dseq: "100", amount: 3 });

      expect(rpcMessageService.getDepositDeploymentMsg).toHaveBeenCalledWith({
        owner: wallet.address,
        dseq: "100",
        amount: 3000000,
        denom: "uakt",
        signer: wallet.address
      });
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [depositMsg]);
      expect(result).toBe(updatedDeployment);
    });

    it("logs a deprecation warning when managed deposit is enabled", async () => {
      const { service, logger } = setup({ isManagedDepositEnabled: true });

      await service.deposit({ userId: "user-1", dseq: "100", amount: 3 });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DEPRECATED_DEPOSIT_DEPLOYMENT_ENDPOINT_USED", userId: "user-1", dseq: "100" })
      );
    });

    it("does not log a deprecation warning when managed deposit is disabled", async () => {
      const { service, logger } = setup({ isManagedDepositEnabled: false });

      await service.deposit({ userId: "user-1", dseq: "100", amount: 3 });

      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("updateByUserIdAndDseq", () => {
    it("sends update tx when manifest hash differs", async () => {
      const { service, signerService, rpcMessageService, deploymentReaderService } = setup();
      const staleDeployment = {
        ...deploymentData,
        deployment: { ...deploymentData.deployment, hash: "stale-hash" }
      };
      deploymentReaderService.findByWalletAndDseq.mockResolvedValueOnce(staleDeployment).mockResolvedValueOnce(deploymentData);
      const updateMsg = { typeUrl: "/update", value: MsgUpdateDeployment.fromPartial({}) };
      rpcMessageService.getUpdateDeploymentMsg.mockReturnValue(updateMsg);

      const result = await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(rpcMessageService.getUpdateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ owner: wallet.address, dseq: "100" }));
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [updateMsg]);
      expect(result).toBe(deploymentData);
    });

    it("skips update tx when manifest hash matches", async () => {
      const { service, signerService, rpcMessageService, sdlService } = setup();
      const manifestVersion = new Uint8Array([1, 2, 3]);
      sdlService.generateManifestVersion.mockResolvedValue(manifestVersion);

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(rpcMessageService.getUpdateDeploymentMsg).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("sends manifest to all unique lease providers", async () => {
      const { service, providerService, deploymentReaderService } = setup();
      const deploymentWithMultipleLeases = {
        ...deploymentData,
        leases: [
          { ...deploymentData.leases[0], id: { ...deploymentData.leases[0].id, provider: "provider-1" } },
          { ...deploymentData.leases[0], id: { ...deploymentData.leases[0].id, provider: "provider-2" } },
          { ...deploymentData.leases[0], id: { ...deploymentData.leases[0].id, provider: "provider-1" } }
        ]
      };
      deploymentReaderService.findByWalletAndDseq.mockResolvedValueOnce(deploymentWithMultipleLeases).mockResolvedValueOnce(deploymentData);
      providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "test-token" });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(providerService.sendManifest).toHaveBeenCalledTimes(2);
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ provider: "provider-1" }));
      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ provider: "provider-2" }));
    });
  });

  function setup(input?: { isManagedDepositEnabled?: boolean; defaultDeposit?: number }) {
    const signerService = mock<ManagedSignerService>();
    const rpcMessageService = mock<RpcMessageService>();
    const sdlService = mock<SdlService>();
    const billingConfig: MockProxy<BillingConfigService> = mockConfigService<BillingConfigService>({
      DEPLOYMENT_GRANT_DENOM: "uakt"
    });
    const providerService = mock<ProviderService>();
    const deploymentReaderService = mock<DeploymentReaderService>();
    const walletReaderService = mock<WalletReaderService>();
    const staleDeploymentsCleaner = mock<StaleManagedDeploymentsCleanerService>();
    const logger = mock<LoggerService>();
    const deploymentConfig: MockProxy<DeploymentConfigService> = mockConfigService<DeploymentConfigService>({
      DEPLOYMENT_DEFAULT_DEPOSIT: input?.defaultDeposit ?? 0.5
    });
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(input?.isManagedDepositEnabled ?? false);

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    sdlService.generateManifest.mockReturnValue({ ok: true, value: manifestValue } as any);
    sdlService.generateManifestVersion.mockResolvedValue(new Uint8Array([4, 5, 6]));
    deploymentReaderService.findByWalletAndDseq.mockResolvedValue(deploymentData);

    const service = new DeploymentWriterService(
      signerService,
      rpcMessageService,
      sdlService,
      billingConfig,
      providerService,
      deploymentReaderService,
      walletReaderService,
      staleDeploymentsCleaner,
      logger,
      deploymentConfig,
      featureFlagsService
    );

    return {
      service,
      signerService,
      rpcMessageService,
      sdlService,
      billingConfig,
      providerService,
      deploymentReaderService,
      walletReaderService,
      staleDeploymentsCleaner,
      logger,
      deploymentConfig,
      featureFlagsService
    };
  }
});
