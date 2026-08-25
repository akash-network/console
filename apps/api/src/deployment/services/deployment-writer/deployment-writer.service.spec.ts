import { DeploymentReclamation, MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { LoggerService } from "@src/core";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { GetDeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import type { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { DeploymentWriterService } from "./deployment-writer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const ENV_VALUE = faker.string.alphanumeric(24);
const REGISTRY_PASSWORD = faker.internet.password();

/** A complete SDL around a service body, plus an optional placement profile nothing references. */
function sdlAround(serviceBody: string, extraPlacement = ""): string {
  return `version: "2.0"
services:
  web:
    image: nginx
${serviceBody}    expose:
      - port: 3000
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          - size: 512Mi
  placement:
    dcloud:
      pricing:
        web:
          denom: uakt
          amount: 1000
${extraPlacement}deployment:
  web:
    dcloud:
      profile: web
      count: 1`;
}

/** A valid SDL carrying an env value and a registry password, so a test can look for them afterwards. */
const SDL_WITH_SECRETS = sdlAround(`    credentials:
      host: registry.example.test
      username: registry-user
      password: ${REGISTRY_PASSWORD}
    env:
      - API_TOKEN=${ENV_VALUE}
`);

/**
 * The shape that turns a small request into an enormous document: one anchored scalar aliased many
 * times over. js-yaml loads every alias back as an independent string, so serializing writes the
 * scalar out in full each time.
 */
const SDL_ALIASING_ONE_SCALAR = sdlAround(`    args:
      - &payload ${"x".repeat(4096)}
${Array.from({ length: 511 }, () => "      - *payload").join("\n")}
`);

/** An SDL with no anchors at all whose serialized length alone puts it past what the console stores. */
const SDL_TOO_LONG_WITHOUT_ALIASES = sdlAround(`    args:
${Array.from({ length: 40 }, () => `      - ${"z".repeat(4096)}`).join("\n")}
`);

/**
 * The other shape, and the one that costs the most to measure: aliases pointing at aliases, doubling
 * the node count per level. It hides under an unreferenced placement profile's `attributes`, the SDL's
 * one free-form position, where the manifest generator never looks — 1.3 KB expanding to 2^24 elements.
 */
const SDL_ALIASING_A_DAG = sdlAround(
  "",
  `    unused:
      attributes:
        a0: &a0 []
${Array.from({ length: 24 }, (_, level) => `        a${level + 1}: &a${level + 1} [*a${level}, *a${level}]`).join("\n")}
      pricing:
        web:
          denom: uakt
          amount: 1000
`
);

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

    it("records the runtime limit alongside the definition", async () => {
      const { service, deploymentSettingRepository } = setup();
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5, runtimeLimitHours: 6 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(expect.objectContaining({ dseq: "1748400000000", runtimeLimitHours: 6 }));
    });

    it("records no runtime limit when none is requested", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(expect.objectContaining({ runtimeLimitHours: undefined }));
    });

    it("records the sdl and the manifest version it commits on chain", async () => {
      const { service, deploymentSettingRepository } = setup();
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith({
        userId: wallet.userId,
        dseq: "1748400000000",
        sdl: expect.stringContaining("API_TOKEN="),
        manifestVersion: "BAUG",
        runtimeLimitHours: undefined
      });
    });

    it("records an sdl carrying none of the submitted env values", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(ENV_VALUE);
    });

    it("records an sdl carrying none of the submitted registry credentials", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(REGISTRY_PASSWORD);
    });

    it("records the definition before broadcasting the create tx", async () => {
      const { service, signerService, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition.mock.invocationCallOrder[0]).toBeLessThan(
        signerService.executeDerivedDecodedTxByUserId.mock.invocationCallOrder[0]
      );
    });

    it("keeps the recorded definition when the create tx fails to broadcast", async () => {
      const { service, signerService, deploymentSettingRepository } = setup();
      signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(new Error("tx failed"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5, runtimeLimitHours: 6 })).rejects.toThrow("tx failed");

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledTimes(1);
    });

    it("broadcasts nothing when the definition cannot be recorded", async () => {
      const { service, signerService, deploymentSettingRepository } = setup();
      deploymentSettingRepository.upsertDefinition.mockRejectedValue(new Error("db down"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).rejects.toThrow("db down");

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("reports a failure to record the definition without logging the sdl", async () => {
      const { service, deploymentSettingRepository, logger } = setup();
      deploymentSettingRepository.upsertDefinition.mockRejectedValue(new Error("db down"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5, runtimeLimitHours: 6 })).rejects.toThrow("db down");

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_DEFINITION_PERSISTENCE_FAILED", runtimeLimitHours: 6 }));
      expect(loggedTextOf(logger)).not.toContain("API_TOKEN");
    });

    it("rejects an sdl the exact serialized length puts past the maximum", async () => {
      const { service } = setup();

      await expect(service.create({ userId: "user-1", sdl: SDL_TOO_LONG_WITHOUT_ALIASES, deposit: 5 })).rejects.toMatchObject({ status: 400 });
    });

    it("rejects an sdl whose aliased scalar the estimate puts past the maximum", async () => {
      const { service } = setup();

      await expect(service.create({ userId: "user-1", sdl: SDL_ALIASING_ONE_SCALAR, deposit: 5 })).rejects.toMatchObject({ status: 400 });
    });

    it("rejects an sdl whose aliases form a doubling graph, without stalling on it", async () => {
      const { service } = setup();

      await expect(service.create({ userId: "user-1", sdl: SDL_ALIASING_A_DAG, deposit: 5 })).rejects.toMatchObject({ status: 400 });
    }, 5000);

    it("records nothing for an sdl it rejects", async () => {
      const { service, deploymentSettingRepository } = setup();

      await expect(service.create({ userId: "user-1", sdl: SDL_ALIASING_ONE_SCALAR, deposit: 5 })).rejects.toThrow();

      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
    });

    it("broadcasts nothing for an sdl it rejects", async () => {
      const { service, signerService } = setup();

      await expect(service.create({ userId: "user-1", sdl: SDL_ALIASING_ONE_SCALAR, deposit: 5 })).rejects.toThrow();

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("says nothing about the sdl beyond its length when rejecting it", async () => {
      const { service, logger } = setup();

      const rejection = (await service.create({ userId: "user-1", sdl: SDL_ALIASING_ONE_SCALAR, deposit: 5 }).catch((error: Error) => error)) as Error;

      expect(rejection.message).not.toContain("payload");
      expect(rejection.message).toContain(String(SDL_MAX_LENGTH));
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SDL_TOO_LARGE", maxLength: SDL_MAX_LENGTH }));
      expect(loggedTextOf(logger)).not.toContain("payload");
    });

    it("never hands the sdl to the logger on a successful create", async () => {
      const { service, logger } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(loggedTextOf(logger)).not.toContain("API_TOKEN");
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
      const { service, rpcMessageService } = setup({ isManagedDepositEnabled: true, defaultDeposit: 1.25 });

      await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 1_250_000 }));
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

    it("does not reclaim trial orphans when a missing deposit will reject the create", async () => {
      const { service, staleDeploymentsCleaner, walletReaderService } = setup({ isManagedDepositEnabled: false });
      walletReaderService.getWalletByUserId.mockResolvedValue({ ...wallet, isTrialing: true });

      await expect(service.create({ userId: "user-1", sdl: "valid-sdl" })).rejects.toMatchObject({ status: 400 });
      expect(staleDeploymentsCleaner.cleanUpForWallet).not.toHaveBeenCalled();
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

  function recordedSdlOf(deploymentSettingRepository: MockProxy<DeploymentSettingRepository>): string {
    const { sdl } = deploymentSettingRepository.upsertDefinition.mock.calls[0][0];
    expect(sdl).not.toBeNull();
    return sdl as string;
  }

  /** Everything the logger was handed, flattened, so a test can assert the sdl reached none of it. */
  function loggedTextOf(logger: MockProxy<LoggerService>): string {
    return [logger.error, logger.warn, logger.info, logger.debug]
      .flatMap(method => method.mock.calls)
      .map(call => JSON.stringify(call))
      .join("");
  }

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
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();

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
      featureFlagsService,
      deploymentSettingRepository
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
      featureFlagsService,
      deploymentSettingRepository
    };
  }
});
