import { DeploymentReclamation, MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { faker } from "@faker-js/faker";
import createError, { NotFound } from "http-errors";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import { JOB_NAME } from "@src/core";
import type { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeleteUnbackedDeploymentSetting } from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import type { SdlService } from "@src/deployment/services/sdl/sdl.service";
import type { ReceivedSdlSecrets, SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import type { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { DeploymentWriterService } from "./deployment-writer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const ALIASED_FILLER = "x".repeat(4096);
const ENV_VALUE = faker.string.alphanumeric(24);
const REGISTRY_PASSWORD = faker.internet.password();
const DEPLOYMENT_SETTING_ID = faker.string.uuid();
const GRACE_IN_MIN = 60;
const RETRY_LIMIT = 47;
const RETRY_DELAY_MAX_IN_MIN = 30;
const RETRY_DELAY_IN_SEC = 30;
const COMPENSATION_JOB_ID = faker.string.uuid();
const SEAL = `${faker.string.alphanumeric(16)}.${faker.string.alphanumeric(16)}`;
const SEALED_TOKEN = `${faker.string.alphanumeric(16)}.${faker.string.alphanumeric(16)}`;

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

const SDL_WITH_SECRETS = sdlAround(`    credentials:
      host: registry.example.test
      username: registry-user
      password: ${REGISTRY_PASSWORD}
    env:
      - API_TOKEN=${ENV_VALUE}
`);

const SDL_ALIASING_ONE_SCALAR = sdlAround(`    args:
      - &payload ${ALIASED_FILLER}
${Array.from({ length: 511 }, () => "      - *payload").join("\n")}
`);

const SDL_TOO_LONG_WITHOUT_ALIASES = sdlAround(`    args:
${Array.from({ length: 40 }, () => `      - ${"z".repeat(4096)}`).join("\n")}
`);

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

  const resolvedManifestValue = {
    groups: [{ name: "resolved-group" }],
    groupSpecs: [{ name: "resolved-group", resources: [] }]
  };

  const parsedSdlValue = { services: { web: { image: "nginx" } } };

  const deploymentData: DeploymentResponse = {
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
    vi.useRealTimers();
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

      expect(result.dseq).toBe(dseq.toString());
      expect(result.signTx).toBe(txResult);
      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: wallet.address,
          dseq: dseq.toString(),
          groups: resolvedManifestValue.groupSpecs,
          denom: "uakt",
          amount: 5000000
        })
      );
      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledWith("user-1", [createMsg]);
    });

    it("throws 400 when SDL is invalid", async () => {
      const { service, sdlService } = setup();
      sdlService.generateResolvedManifest.mockReturnValue({
        ok: false,
        value: [{ message: "invalid version" }]
      } as any);

      await expect(service.create({ userId: "user-1", sdl: "bad-sdl", deposit: 5 })).rejects.toThrow();
    });

    it("throws 400 when a sdl reference cannot be resolved", async () => {
      const { service, sdlService, signerService } = setup();
      sdlService.generateResolvedManifest.mockResolvedValue({
        ok: false,
        value: [{ message: 'no value supplied for SDL Reference "ac-secret://TOKEN"' }]
      } as any);

      await expect(service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 })).rejects.toMatchObject({ status: 400 });
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("returns the manifest built from the resolved sdl", async () => {
      const { service } = setup();

      const result = await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(result.manifest).toContain("resolved-group");
      expect(result.manifest).not.toContain("test-group");
    });

    it("forwards the reclamation block to getCreateDeploymentMsg when the SDL declares it", async () => {
      const { service, sdlService, rpcMessageService } = setup();
      const reclamation = DeploymentReclamation.fromPartial({ minWindow: { seconds: 86400 } });
      const manifest = { ...resolvedManifestValue, reclamation };
      sdlService.generateResolvedManifest.mockReturnValue({ ok: true, value: { manifest, manifestVersion: new Uint8Array(0) } } as any);

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
        sealedSecrets: null,
        runtimeLimitHours: undefined
      });
    });

    it("passes the seal and the sdl exactly as they arrived to the intake", async () => {
      const { service, sdlSecretsService } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(sdlSecretsService.receive).toHaveBeenCalledWith({ sdl: parsedSdlValue, rawSdl: SDL_WITH_SECRETS, sealedSecrets: SEAL });
    });

    it("resolves the manifest from the values the intake handed back", async () => {
      const byService = { web: { TOKEN: "resolved" } };
      const { service, sdlService } = setup({ received: { supplied: { TOKEN: "resolved" }, byService } });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ secrets: byService }));
    });

    it("seals what the client supplied against the dseq it just minted", async () => {
      const supplied = { TOKEN: "resolved" };
      const { service, sdlSecretsService } = setup({ received: { supplied, byService: { web: supplied } } });
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledWith({ userId: wallet.userId, dseq: "1748400000000", secrets: supplied });
    });

    it("records the sealed token in the same write as the sdl it belongs to", async () => {
      const { service, deploymentSettingRepository } = setup({ sealedSecrets: SEALED_TOKEN });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ sealedSecrets: SEALED_TOKEN, sdl: expect.stringContaining("API_TOKEN=") })
      );
    });

    it("states an absent token rather than leaving it unnamed, so a retry cannot inherit one", async () => {
      const { service, deploymentSettingRepository } = setup({ sealedSecrets: null });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(expect.objectContaining({ sealedSecrets: null }));
    });

    it("seals once for the whole create", async () => {
      const supplied = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`SECRET_${index}`, "value"]));
      const { service, sdlSecretsService } = setup({ received: { supplied, byService: { web: supplied, worker: supplied } } });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledOnce();
    });

    it("seals only after the manifest the chain commits to has been hashed", async () => {
      const order: string[] = [];
      const { service, sdlService, sdlSecretsService } = setup();
      sdlService.generateResolvedManifest.mockImplementation(async () => {
        order.push("resolve");
        return { ok: true, value: { manifest: resolvedManifestValue, manifestVersion: new Uint8Array([4, 5, 6]) } } as any;
      });
      sdlSecretsService.sealForStorage.mockImplementation(async () => {
        order.push("seal");
        return SEALED_TOKEN;
      });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(order).toEqual(["resolve", "seal"]);
    });

    it("seals before the record and its compensation are written", async () => {
      const order: string[] = [];
      const { service, sdlSecretsService, txService } = setup();
      sdlSecretsService.sealForStorage.mockImplementation(async () => {
        order.push("seal");
        return SEALED_TOKEN;
      });
      txService.transaction.mockImplementation(async cb => {
        order.push("transaction");
        return await cb();
      });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(order).toEqual(["seal", "transaction"]);
    });

    it("refuses an sdl too large to store before reading the wallet or opening the seal", async () => {
      const { service, walletReaderService, sdlSecretsService, sdlService } = setup();

      await expect(
        service.create({
          userId: "user-1",
          sdl: sdlAround(`    args:\n${Array.from({ length: 40 }, () => `      - ${ALIASED_FILLER}`).join("\n")}\n`),
          deposit: 5
        })
      ).rejects.toMatchObject({ status: 400 });

      expect(walletReaderService.getWalletByUserId).not.toHaveBeenCalled();
      expect(sdlService.generateManifest).not.toHaveBeenCalled();
      expect(sdlSecretsService.receive).not.toHaveBeenCalled();
    });

    it("opens no seal, seals nothing and writes no data key for a request whose deposit it refuses", async () => {
      const { service, sdlSecretsService, deploymentSettingRepository } = setup({ isManagedDepositEnabled: false });

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL })).rejects.toMatchObject({ status: 400 });

      expect(sdlSecretsService.receive).not.toHaveBeenCalled();
      expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
    });

    it("mints no dseq for a request the intake refuses", async () => {
      const { service, sdlSecretsService } = setup();
      sdlSecretsService.receive.mockResolvedValue({ ok: false, value: [{ message: "no value supplied" } as any] });
      const now = vi.spyOn(Date, "now");

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).rejects.toMatchObject({ status: 400 });

      expect(now).not.toHaveBeenCalled();
    });

    it("names what the intake refused in the 400 it answers", async () => {
      const { service, sdlSecretsService } = setup();
      sdlSecretsService.receive.mockResolvedValue({
        ok: false,
        value: [{ message: 'a value was supplied for "TYPOED" but no service\'s SDL references it' } as any]
      });

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 })).rejects.toMatchObject({
        status: 400,
        message: 'Invalid SDL: a value was supplied for "TYPOED" but no service\'s SDL references it'
      });
    });

    it("records nothing, seals nothing and broadcasts nothing for a request the intake refuses", async () => {
      const { service, sdlSecretsService, deploymentSettingRepository, signerService, txService } = setup();
      sdlSecretsService.receive.mockResolvedValue({ ok: false, value: [{ message: "no value supplied" } as any] });

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).rejects.toThrow();

      expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
      expect(txService.transaction).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("records nothing and broadcasts nothing for a seal the intake throws on", async () => {
      const { service, sdlSecretsService, deploymentSettingRepository, signerService } = setup();
      sdlSecretsService.receive.mockRejectedValue(createError(400, "At most 100 secrets may be supplied for one deployment"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 })).rejects.toMatchObject({ status: 400 });

      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("answers 400 for an sdl the intake cannot be handed because it does not parse", async () => {
      const { service, sdlService, sdlSecretsService } = setup();
      sdlService.parse.mockReturnValue({ ok: false, value: [{ message: "bad indentation" }] } as any);

      await expect(service.create({ userId: "user-1", sdl: "bad-sdl", deposit: 5 })).rejects.toMatchObject({
        status: 400,
        message: "Invalid SDL: bad indentation"
      });
      expect(sdlSecretsService.receive).not.toHaveBeenCalled();
    });

    it("says nothing about a supplied value in what it logs", async () => {
      const { service, logger } = setup({ received: { supplied: { TOKEN: ENV_VALUE }, byService: { web: { TOKEN: ENV_VALUE } } } });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(loggedTextOf(logger)).not.toContain(ENV_VALUE);
    });

    it("says whether a token was written rather than what it was when persistence fails", async () => {
      const { service, deploymentSettingRepository, logger } = setup({ sealedSecrets: SEALED_TOKEN });
      deploymentSettingRepository.upsertDefinition.mockRejectedValue(new Error("write failed"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 })).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_DEFINITION_PERSISTENCE_FAILED", hasSealedSecrets: true }));
      expect(loggedTextOf(logger)).not.toContain(SEALED_TOKEN);
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

    it("enqueues a compensation for the definition it records", async () => {
      const { service, jobQueueService } = setup();
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        new DeleteUnbackedDeploymentSetting({ deploymentSettingId: DEPLOYMENT_SETTING_ID, owner: wallet.address, dseq: "1748400000000" }),
        expect.objectContaining({ singletonKey: "deleteUnbackedDeploymentSetting.user-1.1748400000000" })
      );
    });

    it("records nothing and enqueues nothing outside the transaction that has to carry both", async () => {
      const { service, deploymentSettingRepository, jobQueueService } = setup({ transactionRuns: false });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    });

    it("holds the compensation back by the grace a create is given to reach the chain", async () => {
      const { service, jobQueueService } = setup();
      vi.useFakeTimers({ now: new Date("2026-01-01T00:00:00.000Z") });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ startAfter: "2026-01-01T01:00:00.000Z" }));
    });

    it("gives the compensation a retry horizon that outlasts a chain-node outage", async () => {
      const { service, jobQueueService } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(jobQueueService.enqueue).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          retryLimit: RETRY_LIMIT,
          retryBackoff: true,
          retryDelay: RETRY_DELAY_IN_SEC,
          retryDelayMax: RETRY_DELAY_MAX_IN_MIN * 60
        })
      );
    });

    it("refuses the create when the queue accepted no compensation", async () => {
      const { service } = setup({ compensationEnqueued: false });

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).rejects.toThrow(/without a compensation/);
    });

    it("broadcasts nothing when the queue accepted no compensation", async () => {
      const { service, signerService } = setup({ compensationEnqueued: false });

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).rejects.toThrow();

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("cancels the compensation once the create tx is broadcast", async () => {
      const { service, jobQueueService } = setup();
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(jobQueueService.cancelCreatedBy).toHaveBeenCalledWith({
        name: DeleteUnbackedDeploymentSetting[JOB_NAME],
        singletonKey: "deleteUnbackedDeploymentSetting.user-1.1748400000000"
      });
    });

    it("cancels the compensation no earlier than the broadcast that makes it unnecessary", async () => {
      const { service, signerService, jobQueueService } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(signerService.executeDerivedDecodedTxByUserId.mock.invocationCallOrder[0]).toBeLessThan(
        jobQueueService.cancelCreatedBy.mock.invocationCallOrder[0]
      );
    });

    it("leaves the compensation in place when the create tx fails to broadcast", async () => {
      const { service, signerService, jobQueueService } = setup();
      signerService.executeDerivedDecodedTxByUserId.mockRejectedValue(new Error("tx failed"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).rejects.toThrow("tx failed");

      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });

    it("still returns the deployment it created when the compensation cannot be cancelled", async () => {
      const { service, jobQueueService, logger } = setup();
      jobQueueService.cancelCreatedBy.mockRejectedValue(new Error("queue down"));
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      const result = await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(result.dseq).toBe("1748400000000");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "UNBACKED_DEPLOYMENT_SETTING_COMPENSATION_CANCEL_FAILED", userId: "user-1", dseq: "1748400000000" })
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

      expect(rejection.message).not.toContain(ALIASED_FILLER);
      expect(rejection.message).not.toContain("payload");
      expect(rejection.message).toContain(String(SDL_MAX_LENGTH));
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SDL_TOO_LARGE", maxLength: SDL_MAX_LENGTH }));
      expect(loggedTextOf(logger)).not.toContain(ALIASED_FILLER);
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

    it("does not reclaim trial orphans when an oversized sdl will reject the create", async () => {
      const { service, staleDeploymentsCleaner, walletReaderService } = setup();
      walletReaderService.getWalletByUserId.mockResolvedValue({ ...wallet, isTrialing: true });

      await expect(service.create({ userId: "user-1", sdl: SDL_ALIASING_ONE_SCALAR, deposit: 5 })).rejects.toMatchObject({ status: 400 });
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

      await expect(service.close(wallet, "100")).resolves.toBe(true);

      expect(rpcMessageService.getCloseDeploymentMsg).toHaveBeenCalledWith(wallet.address, "100");
      expect(signerService.executeDecodedTxByUserWallet).toHaveBeenCalledWith(wallet, [closeMsg]);
    });

    it("does not broadcast a close tx when the deployment is already closed", async () => {
      const { service, signerService, rpcMessageService, deploymentReaderService } = setup();
      deploymentReaderService.findByWalletAndDseq.mockResolvedValue({
        ...deploymentData,
        deployment: { ...deploymentData.deployment, state: "closed" }
      });

      await expect(service.close(wallet, "100")).resolves.toBe(false);

      expect(rpcMessageService.getCloseDeploymentMsg).not.toHaveBeenCalled();
      expect(signerService.executeDecodedTxByUserWallet).not.toHaveBeenCalled();
    });

    it("reports a close it did not make when a re-read shows the deployment already closed", async () => {
      const { service, signerService, deploymentReaderService } = setup();
      signerService.executeDecodedTxByUserWallet.mockRejectedValue(new Error("deployment already closed"));
      deploymentReaderService.findByWalletAndDseq
        .mockResolvedValueOnce(deploymentData)
        .mockResolvedValueOnce({ ...deploymentData, deployment: { ...deploymentData.deployment, state: "closed" } });

      await expect(service.close(wallet, "100")).resolves.toBe(false);
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

    it("enqueues no compensation for an update, whose deployment the chain has already answered for", async () => {
      const { service, jobQueueService } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      expect(jobQueueService.cancelCreatedBy).not.toHaveBeenCalled();
    });

    it("skips update tx when manifest hash matches", async () => {
      const { service, signerService, rpcMessageService } = setup({ manifestVersion: new Uint8Array([1, 2, 3]) });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(rpcMessageService.getUpdateDeploymentMsg).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("throws 400 when a sdl reference cannot be resolved", async () => {
      const { service, sdlService, providerService } = setup();
      sdlService.generateResolvedManifest.mockResolvedValue({
        ok: false,
        value: [{ message: 'no value supplied for SDL Reference "ac-secret://TOKEN"' }]
      } as any);

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" })).rejects.toMatchObject({ status: 400 });
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("answers a bad reference with 400 even for a deployment it cannot find", async () => {
      const { service, sdlService, deploymentReaderService } = setup();
      sdlService.generateResolvedManifest.mockResolvedValue({ ok: false, value: [{ message: "no value supplied" }] } as any);
      deploymentReaderService.findByWalletAndDseq.mockRejectedValue(new NotFound("Deployment not found"));

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" })).rejects.toMatchObject({ status: 400 });
    });

    it("sends the providers the manifest built from the resolved sdl", async () => {
      const { service, providerService } = setup();
      providerService.toProviderAuth.mockResolvedValue({ type: "jwt", token: "test-token" });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: "valid-sdl" });

      expect(providerService.sendManifest).toHaveBeenCalledWith(expect.objectContaining({ manifest: expect.stringContaining("resolved-group") }));
      expect(providerService.sendManifest).not.toHaveBeenCalledWith(expect.objectContaining({ manifest: expect.stringContaining("test-group") }));
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

    it("records the sdl and the manifest version it re-commits", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith({
        userId: wallet.userId,
        dseq: "100",
        sdl: expect.stringContaining("API_TOKEN="),
        manifestVersion: "BAUG"
      });
    });

    it("records an sdl carrying none of the submitted env values", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(ENV_VALUE);
    });

    it("records an sdl carrying none of the submitted registry credentials", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(REGISTRY_PASSWORD);
    });

    it("records the definition even when the manifest version already matches the chain", async () => {
      const { service, signerService, deploymentSettingRepository } = setup({ manifestVersion: new Uint8Array([1, 2, 3]) });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(expect.objectContaining({ dseq: "100", manifestVersion: "AQID" }));
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("records the definition before it broadcasts or re-sends the manifest", async () => {
      const { service, signerService, providerService, deploymentSettingRepository } = setup();
      deploymentSettingRepository.upsertDefinition.mockRejectedValue(new Error("db down"));

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS })).rejects.toThrow("db down");

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("rejects an sdl too large to store without touching the deployment", async () => {
      const { service, signerService, providerService, deploymentSettingRepository } = setup();

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_TOO_LONG_WITHOUT_ALIASES })).rejects.toMatchObject({ status: 400 });

      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("reports a failure to record the definition without logging the sdl", async () => {
      const { service, deploymentSettingRepository, logger } = setup();
      deploymentSettingRepository.upsertDefinition.mockRejectedValue(new Error("db down"));

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS })).rejects.toThrow("db down");

      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_DEFINITION_PERSISTENCE_FAILED", dseq: "100" }));
      expect(loggedTextOf(logger)).not.toContain(ENV_VALUE);
      expect(loggedTextOf(logger)).not.toContain("API_TOKEN");
    });
  });

  function recordedSdlOf(deploymentSettingRepository: MockProxy<DeploymentSettingRepository>): string {
    const { sdl } = deploymentSettingRepository.upsertDefinition.mock.calls[0][0];
    expect(sdl).not.toBeNull();
    return sdl as string;
  }

  function loggedTextOf(logger: MockProxy<ReturnType<CreateLogger>>): string {
    return [logger.error, logger.warn, logger.info, logger.debug]
      .flatMap(method => method.mock.calls)
      .map(call => JSON.stringify(call))
      .join("");
  }

  it("creates the logger with the service context", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: DeploymentWriterService.name });
  });

  function setup(input?: {
    isManagedDepositEnabled?: boolean;
    defaultDeposit?: number;
    transactionRuns?: boolean;
    compensationEnqueued?: boolean;
    manifestVersion?: Uint8Array;
    received?: ReceivedSdlSecrets;
    sealedSecrets?: string | null;
  }) {
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
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const deploymentConfig: MockProxy<DeploymentConfigService> = mockConfigService<DeploymentConfigService>({
      DEPLOYMENT_DEFAULT_DEPOSIT: input?.defaultDeposit ?? 0.5,
      UNBACKED_DEPLOYMENT_SETTING_GRACE_IN_MIN: GRACE_IN_MIN,
      UNBACKED_DEPLOYMENT_SETTING_RETRY_LIMIT: RETRY_LIMIT,
      UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_IN_SEC: RETRY_DELAY_IN_SEC,
      UNBACKED_DEPLOYMENT_SETTING_RETRY_DELAY_MAX_IN_MIN: RETRY_DELAY_MAX_IN_MIN
    });
    const featureFlagsService = mock<FeatureFlagsService>();
    featureFlagsService.isEnabled.mockReturnValue(input?.isManagedDepositEnabled ?? false);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.upsertDefinition.mockResolvedValue(DEPLOYMENT_SETTING_ID);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => (input?.transactionRuns === false ? (undefined as never) : await cb()));
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue(input?.compensationEnqueued === false ? null : COMPENSATION_JOB_ID);

    const sdlSecretsService = mock<SdlSecretsService>();
    sdlSecretsService.receive.mockResolvedValue({ ok: true, value: input?.received ?? { supplied: {}, byService: {} } });
    sdlSecretsService.sealForStorage.mockResolvedValue(input?.sealedSecrets ?? null);

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    sdlService.parse.mockReturnValue({ ok: true, value: parsedSdlValue } as any);
    sdlService.generateManifest.mockReturnValue({ ok: true, value: manifestValue } as any);
    sdlService.generateManifestVersion.mockResolvedValue(new Uint8Array([4, 5, 6]));
    sdlService.generateResolvedManifest.mockResolvedValue({
      ok: true,
      value: { manifest: resolvedManifestValue, manifestVersion: input?.manifestVersion ?? new Uint8Array([4, 5, 6]) }
    } as any);
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
      createLogger,
      deploymentConfig,
      featureFlagsService,
      deploymentSettingRepository,
      txService,
      jobQueueService,
      sdlSecretsService
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
      createLogger,
      deploymentConfig,
      featureFlagsService,
      deploymentSettingRepository,
      txService,
      jobQueueService,
      sdlSecretsService
    };
  }
});
