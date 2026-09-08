import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import { DeploymentReclamation, MsgAccountDeposit } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import { MsgCloseDeployment, MsgCreateDeployment, MsgUpdateDeployment } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import type { AnyAbility } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError, { NotFound } from "http-errors";
import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock, type MockProxy } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { CreateLogger, JobQueueService, TxService } from "@src/core";
import { JOB_NAME } from "@src/core";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { DeploymentResponse } from "@src/deployment/http-schemas/deployment.schema";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { DeleteUnbackedDeploymentSetting } from "@src/deployment/services/delete-unbacked-deployment-setting/delete-unbacked-deployment-setting.handler";
import type { GenerateResolvedManifestResult, SdlManifest, SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlPatchService } from "@src/deployment/services/sdl-patch/sdl-patch.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import type { DeploymentConfigService } from "../deployment-config/deployment-config.service";
import type { DeploymentReaderService } from "../deployment-reader/deployment-reader.service";
import type { StaleManagedDeploymentsCleanerService } from "../stale-managed-deployments-cleaner/stale-managed-deployments-cleaner.service";
import { DeploymentWriterService } from "./deployment-writer.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const ALIASED_FILLER = "x".repeat(4096);
const ENV_VALUE = faker.string.alphanumeric(24);
const REGISTRY_USERNAME = faker.string.alphanumeric(10);
const REGISTRY_PASSWORD = faker.internet.password();
const DEPLOYMENT_SETTING_ID = faker.string.uuid();
const GRACE_IN_MIN = 60;
const SIGNER_REQUEST_TIMEOUT_MS = 180_000;
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
      username: ${REGISTRY_USERNAME}
      password: ${REGISTRY_PASSWORD}
    env:
      - API_TOKEN=${ENV_VALUE}
`);

const SDL_ALIASING_ONE_SCALAR = sdlAround(`    args:
      - &payload ${ALIASED_FILLER}
${Array.from({ length: 511 }, () => "      - *payload").join("\n")}
`);

/** Past what the console stores only because its env values are kept, and carrying one a refusal must not echo. */
const SDL_TOO_LONG_ONCE_VALUES_ARE_KEPT = sdlAround(`    env:
      - API_TOKEN=${ENV_VALUE}
${Array.from({ length: 40 }, () => `      - FILLER=${"z".repeat(4096)}`).join("\n")}
`);

/** A valid SDL with nothing in it worth sealing, so a write that must state a token has null to state. */
const SDL_WITHOUT_SECRETS = sdlAround("");

/** `js-yaml` trims the end of the line it quotes and never the start, so it is the variable name below that carries the leak assertion: this value survives untruncated at ten characters but would not at thirty-two. */
const MALFORMED_SDL_VALUE = faker.string.alphanumeric(10);

/** Not YAML at all, and carrying an env value, because a `js-yaml` message quotes the lines around the one it failed on. */
const MALFORMED_SDL_CARRYING_A_VALUE = `version: "2.0"
services:
  web:
    image: nginx
    env:
      - LEAKED=${MALFORMED_SDL_VALUE}
     bad: indentation
`;

/** An SDL with no anchors at all whose serialized length alone puts it past what the console stores. */
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

const CLIENT_SEAL = "client.seal.aaa.bbb.ccc";

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

      const result = await service.create({ userId: "user-1", sdl: "valid-sdl" });

      expect(result.dseq).toBe(dseq.toString());
      expect(result.signTx).toBe(txResult);
      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: wallet.address,
          dseq: dseq.toString(),
          groups: resolvedManifestValue.groupSpecs,
          denom: "uakt",
          amount: 500000
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

    it("returns the manifest built from the submitted sdl, not the resolved one it hashed", async () => {
      const { service } = setup();

      const result = await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(result.manifest).toContain("test-group");
      expect(result.manifest).not.toContain("resolved-group");
    });

    it("applies the trial limits to the manifest it hashes and not to the one it returns", async () => {
      const { service, sdlService, walletReaderService } = setup();
      walletReaderService.getWalletByUserId.mockResolvedValue({ ...wallet, isTrialing: true });

      await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ isTrialing: true }));
      expect(sdlService.generateManifest).toHaveBeenCalledWith("valid-sdl");
    });

    it("builds the returned manifest before broadcasting, so a document it cannot rebuild costs no deployment on chain", async () => {
      const { service, sdlService, signerService } = setup();
      sdlService.generateManifest.mockResolvedValue({ ok: false, value: [mock<ValidationError>({ message: "unbuildable" })] });

      await expect(service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 })).rejects.toMatchObject({ status: 400 });

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
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
      const received = { TOKEN: "resolved" };
      const { service, sdlService } = setup({ received });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ secrets: received }));
    });

    it("seals what the client supplied together with the credentials it took out itself, against the dseq it just minted", async () => {
      const { service, sdlSecretsService } = setup({ received: { TOKEN: "resolved" } });
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledWith({
        userId: wallet.userId,
        dseq: "1748400000000",
        secrets: { TOKEN: "resolved", s0_c_username: REGISTRY_USERNAME, s0_c_password: REGISTRY_PASSWORD }
      });
    });

    it("seals every env value as well when no seal said which of them are secret", async () => {
      const { service, sdlSecretsService } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledWith(
        expect.objectContaining({ secrets: { s0_e0: ENV_VALUE, s0_c_username: REGISTRY_USERNAME, s0_c_password: REGISTRY_PASSWORD } })
      );
    });

    it("refuses a supplied name the console derives for the same deployment, before minting a dseq", async () => {
      const { service, deploymentSettingRepository, signerService } = setup({ received: { s0_c_password: "resolved" } });
      const dateNow = vi.spyOn(Date, "now");

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 })).rejects.toMatchObject({
        status: 400,
        message: expect.stringContaining("s0_c_password")
      });

      expect(dateNow).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("records the sealed token in the same write as the sdl it belongs to", async () => {
      const { service, deploymentSettingRepository } = setup({ sealedSecrets: SEALED_TOKEN });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(
        expect.objectContaining({ sealedSecrets: SEALED_TOKEN, sdl: expect.stringContaining(`API_TOKEN=${ENV_VALUE}`) })
      );
    });

    it("states an absent token rather than leaving it unnamed, so a retry cannot inherit one", async () => {
      const { service, deploymentSettingRepository } = setup({ sealedSecrets: null });

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(expect.objectContaining({ sealedSecrets: null }));
    });

    it("seals once for the whole create", async () => {
      const received = Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`SECRET_${index}`, "value"]));
      const { service, sdlSecretsService } = setup({ received });

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

    it("opens no seal, seals nothing and writes no data key for a request whose sdl it refuses", async () => {
      const { service, sdlSecretsService, deploymentSettingRepository } = setup();

      await expect(service.create({ userId: "user-1", sdl: SDL_ALIASING_ONE_SCALAR, sealedSecrets: SEAL })).rejects.toMatchObject({ status: 400 });

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
      const { service, logger } = setup({ received: { TOKEN: ENV_VALUE } });

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

    it("records an sdl carrying none of the submitted env values when no seal said which of them are secret", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(recordedSdlOf(deploymentSettingRepository)).toContain("API_TOKEN=");
      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(ENV_VALUE);
    });

    it("records the submitted env value as it arrived once a seal has said which values are secret", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 });

      expect(recordedSdlOf(deploymentSettingRepository)).toContain(`API_TOKEN=${ENV_VALUE}`);
    });

    it.each([
      { named: "no seal", sealedSecrets: undefined },
      { named: "a seal", sealedSecrets: SEAL }
    ])("records an sdl carrying none of the submitted registry credentials, given $named", async ({ sealedSecrets }) => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets, deposit: 5 });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(REGISTRY_PASSWORD);
    });

    it("says nothing of the values it stores when persistence fails", async () => {
      const { service, deploymentSettingRepository, logger } = setup();
      deploymentSettingRepository.upsertDefinition.mockRejectedValue(new Error("write failed"));

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, sealedSecrets: SEAL, deposit: 5 })).rejects.toThrow();

      expect(recordedSdlOf(deploymentSettingRepository)).toContain(`API_TOKEN=${ENV_VALUE}`);
      expect(loggedTextOf(logger)).not.toContain(ENV_VALUE);
    });

    it("says nothing of the values it would have stored when the sdl is too large to keep", async () => {
      const { service, logger } = setup();

      const thrown = await service.create({ userId: "user-1", sdl: SDL_TOO_LONG_ONCE_VALUES_ARE_KEPT, sealedSecrets: SEAL, deposit: 5 }).catch(error => error);

      expect(thrown).toMatchObject({ status: 400 });
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SDL_TOO_LARGE", maxLength: SDL_MAX_LENGTH }));
      expect(loggedTextOf(logger)).not.toContain(ENV_VALUE);
      expect(thrownTextOf(thrown)).not.toContain(ENV_VALUE);
    });

    it("names the position it stopped parsing at, in numbers, carrying no text of the document", async () => {
      const { service, logger } = setup();

      const thrown = await service.create({ userId: "user-1", sdl: MALFORMED_SDL_CARRYING_A_VALUE, sealedSecrets: SEAL, deposit: 5 }).catch(error => error);

      expect(thrown).toMatchObject({ status: 400, message: "SDL is not valid YAML: line 7, column 6" });
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SDL_UNPARSEABLE", line: 7, column: 6 }));
      expect(thrownTextOf(thrown)).not.toContain(MALFORMED_SDL_VALUE);
      expect(thrownTextOf(thrown)).not.toContain("LEAKED");
      expect(loggedTextOf(logger)).not.toContain("LEAKED");
    });

    it("refuses an sdl that is not yaml as unparseable rather than as too large", async () => {
      const { service, logger } = setup();

      const thrown = await service.create({ userId: "user-1", sdl: MALFORMED_SDL_CARRYING_A_VALUE, sealedSecrets: SEAL, deposit: 5 }).catch(error => error);

      expect(thrown).toMatchObject({ status: 400, message: expect.stringContaining("SDL is not valid YAML") });
      expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "DEPLOYMENT_SDL_UNPARSEABLE" }));
    });

    it("says nothing of the document a parse error quoted, in what it throws or what it logs", async () => {
      const { service, logger } = setup();

      const thrown = await service.create({ userId: "user-1", sdl: MALFORMED_SDL_CARRYING_A_VALUE, sealedSecrets: SEAL, deposit: 5 }).catch(error => error);

      expect(thrownTextOf(thrown)).not.toContain(MALFORMED_SDL_VALUE);
      expect(thrownTextOf(thrown)).not.toContain("LEAKED");
      expect(loggedTextOf(logger)).not.toContain(MALFORMED_SDL_VALUE);
      expect(loggedTextOf(logger)).not.toContain("LEAKED");
    });

    it("still stores an sdl too long to keep the values of, when no seal said which of them are secret", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.create({ userId: "user-1", sdl: SDL_TOO_LONG_ONCE_VALUES_ARE_KEPT, deposit: 5 });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(ENV_VALUE);
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

    it("goes on with the create when the queue refused the compensation because one is already waiting for the row", async () => {
      const { service, signerService, logger } = setup({ compensationEnqueued: false, compensationAlreadyWaiting: true });
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await expect(service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 })).resolves.toMatchObject({ dseq: "1748400000000" });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ event: "UNBACKED_DEPLOYMENT_SETTING_COMPENSATION_ALREADY_WAITING", dseq: "1748400000000" })
      );
    });

    it("asks for a compensation still waiting under the key the create would have enqueued, and not due before the signer could have given up", async () => {
      const { service, jobQueueService } = setup({ compensationEnqueued: false, compensationAlreadyWaiting: true });
      vi.spyOn(Date, "now").mockReturnValue(1748400000000);

      await service.create({ userId: "user-1", sdl: SDL_WITH_SECRETS, deposit: 5 });

      expect(jobQueueService.hasWaitingSingleton).toHaveBeenCalledWith({
        name: DeleteUnbackedDeploymentSetting[JOB_NAME],
        singletonKey: "deleteUnbackedDeploymentSetting.user-1.1748400000000",
        notDueBefore: new Date(1748400000000 + SIGNER_REQUEST_TIMEOUT_MS)
      });
    });

    it("refuses the create when the queue accepted no compensation and none is still waiting for the row", async () => {
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

    it("ignores the caller deposit and uses the configured default", async () => {
      const { service, rpcMessageService } = setup({ defaultDeposit: 1.25 });

      await service.create({ userId: "user-1", sdl: "valid-sdl", deposit: 5 });

      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 1_250_000 }));
    });

    it("creates a deployment without a caller deposit", async () => {
      const { service, rpcMessageService } = setup({ defaultDeposit: 0.5 });

      await service.create({ userId: "user-1", sdl: "valid-sdl" });

      expect(rpcMessageService.getCreateDeploymentMsg).toHaveBeenCalledWith(expect.objectContaining({ amount: 500000 }));
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

    it("logs a deprecation warning on every deposit", async () => {
      const { service, logger } = setup();

      await service.deposit({ userId: "user-1", dseq: "100", amount: 3 });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ event: "DEPRECATED_DEPOSIT_DEPLOYMENT_ENDPOINT_USED", userId: "user-1", dseq: "100" })
      );
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

    it("records the sdl, the manifest version it re-commits and the token it sealed", async () => {
      const { service, deploymentSettingRepository } = setup({ sealedSecrets: SEALED_TOKEN });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith({
        userId: wallet.userId,
        dseq: "100",
        sdl: expect.stringContaining("API_TOKEN=ac-secret://s0_e0"),
        manifestVersion: "BAUG",
        sealedSecrets: SEALED_TOKEN
      });
    });

    it("seals every value of the sdl it was resubmitted, against the dseq it is updating", async () => {
      const { service, sdlSecretsService } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledWith({
        userId: wallet.userId,
        dseq: "100",
        secrets: { s0_e0: ENV_VALUE, s0_c_username: REGISTRY_USERNAME, s0_c_password: REGISTRY_PASSWORD }
      });
    });

    it("states an absent token rather than leaving the create's beside an sdl that no longer references it", async () => {
      const { service, deploymentSettingRepository } = setup({ sealedSecrets: null });

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITHOUT_SECRETS });

      expect(deploymentSettingRepository.upsertDefinition).toHaveBeenCalledWith(expect.objectContaining({ sealedSecrets: null }));
    });

    it("seals only after everything that could still refuse the update has run", async () => {
      const { service, sdlSecretsService, deploymentReaderService } = setup();
      deploymentReaderService.findByWalletAndDseq.mockRejectedValue(new NotFound("Deployment not found"));

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS })).rejects.toMatchObject({ status: 404 });

      expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
    });

    it("records nothing and sends no manifest for an update it cannot seal", async () => {
      const { service, sdlSecretsService, deploymentSettingRepository, providerService } = setup();
      sdlSecretsService.sealForStorage.mockRejectedValue(createError(503, "Service temporarily unavailable"));

      await expect(service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS })).rejects.toMatchObject({ status: 503 });

      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });

    it("records an sdl carrying none of the submitted env values, referencing a sealed one in each place", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(ENV_VALUE);
      expect(recordedSdlOf(deploymentSettingRepository)).toContain("API_TOKEN=ac-secret://s0_e0");
    });

    it("records an sdl referencing both halves of the submitted registry credentials and carrying neither", async () => {
      const { service, deploymentSettingRepository } = setup();

      await service.updateByUserIdAndDseq("user-1", "100", { sdl: SDL_WITH_SECRETS });

      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(REGISTRY_PASSWORD);
      expect(recordedSdlOf(deploymentSettingRepository)).not.toContain(REGISTRY_USERNAME);
      expect(recordedSdlOf(deploymentSettingRepository)).toContain("username: ac-secret://s0_c_username");
      expect(recordedSdlOf(deploymentSettingRepository)).toContain("password: ac-secret://s0_c_password");
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

  /** Everything a thrown refusal carries, cause chain included, because the error handler logs the whole chain even when the response body carries none of it. */
  function thrownTextOf(thrown: unknown): string {
    const parts: string[] = [];

    for (let current: unknown = thrown; current instanceof Error; current = current.cause) {
      parts.push(current.message, current.stack ?? "", JSON.stringify(current, Object.getOwnPropertyNames(current)));
    }

    return parts.join("");
  }

  /** Everything the logger was handed, flattened, so a test can assert the sdl reached none of it. */
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

  describe("patchByUserIdAndDseq", () => {
    const STORED_VERSION = "U1RPUkVEVkVSU0lPTg==";
    const STORED_TOKEN = "stored.token.aaa.bbb.ccc";
    const STORED_SDL = [
      'version: "2.0"',
      "services:",
      "  web:",
      "    image: nginx",
      "    env:",
      "      - API_TOKEN=ac-secret://s0_e0",
      "      - DATABASE_URL=ac-secret://s0_e1",
      "profiles:",
      "  compute:",
      "    web:",
      "      resources:",
      "        cpu:",
      "          units: 0.1",
      "        memory:",
      "          size: 128Mi",
      "        storage:",
      "          - size: 128Mi",
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      "      count: 1",
      ""
    ].join("\n");

    /** A deployment created WITH a client seal keeps ordinary env values in the clear, which is the state that made the document-wide derivation reachable. */
    const STORED_SDL_WITH_PLAINTEXT = [
      'version: "2.0"',
      "services:",
      "  web:",
      "    image: nginx",
      "    env:",
      "      - API_TOKEN=ac-secret://s0_e0",
      "  worker:",
      "    image: busybox",
      "    env:",
      "      - LOG_LEVEL=debug",
      "profiles:",
      "  compute:",
      "    web:",
      "      resources:",
      "        cpu:",
      "          units: 0.1",
      "        memory:",
      "          size: 128Mi",
      "        storage:",
      "          - size: 128Mi",
      "    worker:",
      "      resources:",
      "        cpu:",
      "          units: 0.1",
      "        memory:",
      "          size: 128Mi",
      "        storage:",
      "          - size: 128Mi",
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "        worker:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      "      count: 1",
      "  worker:",
      "    dcloud:",
      "      profile: worker",
      "      count: 1",
      ""
    ].join("\n");

    describe("a plaintext value the patch never named", () => {
      it("leaves an untouched service's plaintext env value in the clear", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

        const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
        expect(sdl).toContain("LOG_LEVEL=debug");
      });

      it("does not pull an untouched service's value into the token", async () => {
        const { service, ability, sealedFor } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

        expect(sealedFor()).toEqual({ s0_e0: "token" });
      });

      it("leaves a plaintext value in the very service it patched, when the patch did not name that variable", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { worker: { image: "busybox:1.36" } } }, ability);

        const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
        expect(sdl).toContain("LOG_LEVEL=debug");
      });

      it("seals a value the patch does write, in that same service", async () => {
        const { service, ability, sealedFor, deploymentSettingRepository } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { worker: { env: { LOG_LEVEL: "trace" } } } }, ability);

        const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
        expect(sdl).not.toContain("LOG_LEVEL=trace");
        expect(sdl).toContain("LOG_LEVEL=ac-secret://s1_e0");
        expect(sealedFor()).toEqual({ s0_e0: "token", s1_e0: "trace" });
      });
    });

    describe("the name a re-supplied value ends up stored under", () => {
      it("gives a patched variable a different derived name, since names need only be unique", async () => {
        const { service, ability, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } }, ability);

        const names = Object.keys(sealedFor());
        expect(names).not.toContain("s0_e0");
        expect(Object.values(sealedFor())).toEqual(expect.arrayContaining(["rotated", "kept"]));
      });

      it("drops the name the value used to be stored under from the re-sealed token", async () => {
        const { service, ability, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } }, ability);

        expect(sealedFor()).not.toHaveProperty("s0_e0");
      });

      it("keeps the value of every variable the patch did not name, whatever name it now sits under", async () => {
        const { service, ability, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } }, ability);

        expect(Object.values(sealedFor())).toContain("kept");
      });

      it("records an sdl whose references all resolve against the re-sealed token", async () => {
        const { service, ability, sealedFor, deploymentSettingRepository, sdlReferenceService } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } }, ability);

        const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
        const document = yaml.raw<SDLInput>(sdl);
        expect(sdlReferenceService.substitute(document, { secrets: sealedFor() })).toEqual([]);
      });
    });

    describe("the size of the set it would store", () => {
      it("refuses when the merged set exceeds the count a deployment may carry", async () => {
        const held = Object.fromEntries(Array.from({ length: 2 }, (_, index) => [`s0_e${index}`, "value"]));
        const { service, ability } = setup({ held, maxCount: 1 });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toMatchObject({ status: 400 });
      });

      it("measures what it would store, not merely what the request supplied", async () => {
        const { service, ability, sdlSecretsService } = setup({ held: { s0_e0: "a", s0_e1: "b" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({ s0_e0: "a", s0_e1: "b" });
      });

      it("writes nothing when the merged set is refused", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ held: { s0_e0: "a", s0_e1: "b" }, maxCount: 1 });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toThrow();
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });
    });

    describe("a supplied name the patched sdl does not reference", () => {
      it("refuses it rather than dropping it, naming the name", async () => {
        const { service, ability } = setup({ held: { s0_e0: "a" }, supplied: { s0_eTYPO: "rotated" } });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, sealedSecrets: CLIENT_SEAL }, ability)
        ).rejects.toThrow(/s0_eTYPO/);
      });

      it("answers 400", async () => {
        const { service, ability } = setup({ held: { s0_e0: "a" }, supplied: { s0_eTYPO: "rotated" } });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, sealedSecrets: CLIENT_SEAL }, ability)
        ).rejects.toMatchObject({
          status: 400
        });
      });

      it("writes nothing", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ held: { s0_e0: "a" }, supplied: { s0_eTYPO: "rotated" } });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, sealedSecrets: CLIENT_SEAL }, ability)
        ).rejects.toThrow();
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });

      it("still drops a stored name the patched sdl stopped referencing, without complaint", async () => {
        const { service, ability, sealedFor } = setup({ held: { s0_e0: "kept", s0_e1: "orphan" } });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { DATABASE_URL: null } } } }, ability);

        expect(sealedFor()).toEqual({ s0_e0: "kept" });
      });
    });

    it("patches the sdl the console stored rather than one the request carries", async () => {
      const { service, ability, deploymentSettingRepository } = setup();

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(deploymentSettingRepository.findOneBy).toHaveBeenCalledWith({ userId: "user-1", dseq: "1234" });
    });

    it("records the patched document, carrying the new image", async () => {
      const { service, ability, deploymentSettingRepository } = setup();

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).toHaveBeenCalledWith(
        expect.objectContaining({ sdl: expect.stringContaining("nginx:1.27") })
      );
    });

    it("keeps every stored value the patched sdl still references", async () => {
      const { service, ability, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "postgres://db" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(sealedFor()).toEqual({ s0_e0: "token", s0_e1: "postgres://db" });
    });

    it("overlays a supplied value over the stored one under the same name", async () => {
      const { service, ability, sealedFor } = setup({ held: { s0_e0: "old", s0_e1: "kept" }, supplied: { s0_e0: "rotated" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: {} }, sealedSecrets: CLIENT_SEAL }, ability);

      expect(sealedFor()).toEqual({ s0_e0: "rotated", s0_e1: "kept" });
    });

    it("drops a name the patched sdl no longer references", async () => {
      const { service, ability, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "dropped" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { DATABASE_URL: null } } } }, ability);

      expect(sealedFor()).toEqual({ s0_e0: "token" });
    });

    it("opens the stored token under the very deployment and user the row belongs to", async () => {
      const { service, ability, sdlSecretsService } = setup({ held: { s0_e0: "token" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(sdlSecretsService.openStored).toHaveBeenCalledWith({ userId: "user-1", dseq: "1234", sealedSecrets: STORED_TOKEN });
    });

    it("opens the client's seal against the sdl the console stored, which is what it was sealed to", async () => {
      const { service, ability, sdlSecretsService } = setup({ supplied: { s0_e0: "rotated" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: {} }, sealedSecrets: CLIENT_SEAL }, ability);

      expect(sdlSecretsService.receiveForMerge).toHaveBeenCalledWith({ rawSdl: STORED_SDL, sealedSecrets: CLIENT_SEAL });
    });

    it("opens the stored token exactly once however many secrets change", async () => {
      const { service, ability, sdlSecretsService } = setup({ held: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`s0_e${i}`, `v${i}`])) });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(sdlSecretsService.openStored).toHaveBeenCalledTimes(1);
    });

    it("seals the merged set exactly once", async () => {
      const { service, ability, sdlSecretsService } = setup({ held: { s0_e0: "a", s0_e1: "b" }, supplied: { s0_e0: "c" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(sdlSecretsService.sealForStorage).toHaveBeenCalledTimes(1);
    });

    it("reaches no key service at all when the deployment holds no token and the patch supplies none", async () => {
      const { service, ability, sdlSecretsService } = setup({
        storedToken: null,
        sdl: STORED_SDL.replace(/ *- API_TOKEN.*\n/, "").replace(/ *- DATABASE_URL.*\n/, "")
      });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

      expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
      expect(sdlSecretsService.receiveForMerge).not.toHaveBeenCalled();
    });

    describe("a refusal", () => {
      it("answers 404 for a deployment the console recorded no sdl for", async () => {
        const { service, ability } = setup({ setting: undefined });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toMatchObject({ status: 404 });
      });

      it("writes nothing when the patch names a service the sdl does not declare", async () => {
        const { service, ability, deploymentSettingRepository } = setup();

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { api: { image: "x" } } }, ability)).rejects.toMatchObject({ status: 400 });
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });

      it("spends no key-service call on a patch it refuses structurally", async () => {
        const { service, ability, sdlSecretsService } = setup({ held: { s0_e0: "a" } });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { api: { image: "x" } } }, ability)).rejects.toThrow();
        expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
        expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
      });

      it("answers 400 naming the reference it holds no value for", async () => {
        const { service, ability } = setup({
          held: {},
          resolveErrors: [
            {
              schemaPath: "",
              instancePath: "",
              keyword: "sdl-reference",
              params: {},
              message: 'no value supplied for SDL Reference "ac-secret://s0_e0" in service "web"'
            }
          ]
        });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toThrow(/ac-secret:\/\/s0_e0/);
      });

      it("writes nothing when a reference resolves to no value", async () => {
        const { service, ability, deploymentSettingRepository } = setup({
          held: {},
          resolveErrors: [{ schemaPath: "", instancePath: "", keyword: "sdl-reference", params: {}, message: "no value" }]
        });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toThrow();
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });

      it("answers 409 when the version the patch expected is no longer current", async () => {
        const { service, ability } = setup({ written: undefined });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, ifManifestVersion: "STALE" }, ability)
        ).rejects.toMatchObject({
          status: 409
        });
      });

      it("sends no manifest to any provider when the write is refused", async () => {
        const { service, ability, providerService } = setup({ written: undefined });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, ifManifestVersion: "STALE" }, ability)
        ).rejects.toThrow();
        expect(providerService.sendManifest).not.toHaveBeenCalled();
      });
    });

    describe("stored state the console cannot read or store back", () => {
      it("answers a permanent 5xx when the recorded sdl will not parse", async () => {
        const { service, ability } = setup({ sdl: "services: [this is not: valid: yaml" });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toMatchObject({
          status: 500,
          errorCode: "stored_sdl_unreadable"
        });
      });

      it("writes nothing when the recorded sdl will not parse", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ sdl: "services: [this is not: valid: yaml" });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toThrow();
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });

      it("refuses a patched document too large to store, naming the bound", async () => {
        const { service, ability } = setup({ held: {}, sdl: STORED_SDL });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "n".repeat(SDL_MAX_LENGTH + 1) } } }, ability)
        ).rejects.toMatchObject({
          status: 400
        });
      });

      it("writes nothing when the patched document is too large to store", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ held: {}, sdl: STORED_SDL });

        await expect(
          service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "n".repeat(SDL_MAX_LENGTH + 1) } } }, ability)
        ).rejects.toThrow();
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });
    });

    describe("a stored token that will not open", () => {
      it("fails with the permanent 5xx rather than a retryable one", async () => {
        const { service, ability } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toMatchObject({
          status: 500,
          message: SECRET_UNREADABLE_ERROR_MESSAGE
        });
      });

      it("never overwrites the token it could not read", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toThrow();
        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
      });

      it("re-seals nothing", async () => {
        const { service, ability, sdlSecretsService } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toThrow();
        expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
      });

      it("keeps a key service that is merely unreachable answering its retryable status", async () => {
        const { service, ability } = setup({ openStoredError: createError(503, "Service temporarily unavailable") });

        await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability)).rejects.toMatchObject({ status: 503 });
      });
    });

    describe("what it commits and pushes", () => {
      it("broadcasts an update when the patched manifest version differs from the chain's", async () => {
        const { service, ability, signerService } = setup({ chainHash: "SOMETHING_ELSE" });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
      });

      it("broadcasts nothing when the chain already holds the patched version", async () => {
        const { service, ability, signerService } = setup({ chainHash: Buffer.from(new Uint8Array([1, 2, 3])).toString("base64") });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
      });

      it("sends the resolved manifest to each lease provider once", async () => {
        const { service, ability, providerService } = setup({ providers: ["akash1provider", "akash1other"] });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(providerService.sendManifest).toHaveBeenCalledTimes(2);
      });

      it("returns the manifest version it recorded", async () => {
        const { service, ability } = setup();

        const result = await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(result.manifestVersion).toBe(Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"));
      });

      it("guards a patch naming no version on the version it read, so a concurrent patch cannot be discarded unseen", async () => {
        const { service, ability, deploymentSettingRepository } = setup();

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).toHaveBeenCalledWith(
          expect.objectContaining({ expectedManifestVersion: STORED_VERSION })
        );
      });

      it("prefers the version the caller named over the one it read", async () => {
        const { service, ability, deploymentSettingRepository } = setup();

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, ifManifestVersion: "Q0xJRU5U" }, ability);

        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).toHaveBeenCalledWith(
          expect.objectContaining({ expectedManifestVersion: "Q0xJRU5U" })
        );
      });

      it("guards on nothing when the row records no version to guard on", async () => {
        const { service, ability, deploymentSettingRepository } = setup({ storedVersion: null });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } }, ability);

        expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).toHaveBeenCalledWith(
          expect.objectContaining({ expectedManifestVersion: undefined })
        );
      });

      it("resolves the very bytes it recorded", async () => {
        const { service, ability, sdlService, deploymentSettingRepository } = setup();

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

        const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
        expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ sdl }));
      });
    });

    describe("the trial limits a wallet is still under", () => {
      it("resolves a trialing wallet's patch under them", async () => {
        const { service, sdlService, ability } = setup({ isTrialing: true });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

        expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ isTrialing: true }));
      });

      it("resolves an established wallet's patch without them", async () => {
        const { service, sdlService, ability } = setup({ isTrialing: false });

        await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } }, ability);

        expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ isTrialing: false }));
      });
    });

    function setup(input?: {
      sdl?: string;
      setting?: DeploymentSettingsOutput | undefined;
      storedVersion?: string | null;
      storedToken?: string | null;
      held?: Record<string, string>;
      supplied?: Record<string, string>;
      resolveErrors?: Array<{ schemaPath: string; instancePath: string; keyword: string; params: Record<string, unknown>; message: string }>;
      maxCount?: number;
      written?: string | undefined;
      chainHash?: string;
      providers?: string[];
      openStoredError?: Error;
      isTrialing?: boolean;
    }) {
      const manifestVersion = new Uint8Array([1, 2, 3]);
      const storedToken = input?.storedToken === undefined ? STORED_TOKEN : input.storedToken;
      const hasSetting = !("setting" in (input ?? {})) || input?.setting !== undefined;

      const walletReaderService = mock<WalletReaderService>();
      walletReaderService.getWalletByUserId.mockResolvedValue(
        mock<WalletInitialized>({ id: 7, userId: "user-1", address: "akash1owner", isTrialing: input?.isTrialing ?? false })
      );

      const deploymentSettingRepository = mock<DeploymentSettingRepository>();
      const scoped = mock<DeploymentSettingRepository>();
      const storedVersion = input?.storedVersion === undefined ? STORED_VERSION : input.storedVersion;
      scoped.findOneBy.mockResolvedValue(
        hasSetting ? mock<DeploymentSettingsOutput>({ sdl: input?.sdl ?? STORED_SDL, sealedSecrets: storedToken, manifestVersion: storedVersion }) : undefined
      );
      scoped.replaceDefinitionIfVersionMatches.mockResolvedValue("written" in (input ?? {}) ? input!.written : randomUUID());
      deploymentSettingRepository.accessibleBy.mockReturnValue(scoped);

      const deploymentReaderService = mock<DeploymentReaderService>();
      deploymentReaderService.findByWalletAndDseq.mockResolvedValue({
        deployment: { id: { owner: "akash1owner", dseq: "1234" }, state: "active", hash: input?.chainHash ?? "OTHER", created_at: "" },
        leases: (input?.providers ?? ["akash1provider"]).map(provider =>
          mock<Awaited<ReturnType<DeploymentReaderService["findByWalletAndDseq"]>>["leases"][number]>({ id: { provider } })
        ),
        escrow_account: mock()
      });

      const resolved: GenerateResolvedManifestResult = input?.resolveErrors
        ? { ok: false, value: input.resolveErrors }
        : { ok: true, value: { manifestVersion, manifest: mock<SdlManifest>({ groups: [] }) } };
      const sdlService = mock<SdlService>();
      sdlService.generateResolvedManifest.mockResolvedValue(resolved);

      const sdlSecretsService = mock<SdlSecretsService>();
      if (input?.openStoredError) sdlSecretsService.openStored.mockRejectedValue(input.openStoredError);
      else sdlSecretsService.openStored.mockResolvedValue(input?.held ?? {});
      sdlSecretsService.receiveForMerge.mockResolvedValue(input?.supplied ?? {});
      sdlSecretsService.sealForStorage.mockResolvedValue("resealed.token.aaa.bbb.ccc");
      const maxCount = input?.maxCount;
      sdlSecretsService.assertStorable.mockImplementation(secrets => {
        if (maxCount !== undefined && Object.keys(secrets).length > maxCount) {
          throw createError(400, `At most ${maxCount} secrets may be supplied for one deployment`);
        }
      });

      const providerService = mock<ProviderService>();
      const signerService = mock<ManagedSignerService>();
      const logger = mock<ReturnType<CreateLogger>>();
      const createLogger: CreateLogger = () => logger;

      const sdlReferenceService = new SdlReferenceService();
      const ability = mock<AnyAbility>();
      const service = new DeploymentWriterService(
        signerService,
        mock<RpcMessageService>(),
        sdlService,
        mockConfigService<BillingConfigService>({}),
        providerService,
        deploymentReaderService,
        walletReaderService,
        mock<StaleManagedDeploymentsCleanerService>(),
        createLogger,
        mockConfigService<DeploymentConfigService>({}),
        deploymentSettingRepository,
        mock<TxService>(),
        mock<JobQueueService>(),
        sdlSecretsService,
        new SdlSecretsDerivationService(new SdlReferenceService()),
        new SdlPatchService(),
        sdlReferenceService
      );

      function sealedFor() {
        return vi.mocked(sdlSecretsService.sealForStorage).mock.calls[0][0].secrets;
      }

      return {
        service,
        ability,
        deploymentSettingRepository: scoped,
        deploymentReaderService,
        sdlService,
        sdlSecretsService,
        providerService,
        signerService,
        logger,
        sdlReferenceService,
        sealedFor
      };
    }
  });

  function setup(input?: {
    defaultDeposit?: number;
    transactionRuns?: boolean;
    compensationEnqueued?: boolean;
    compensationAlreadyWaiting?: boolean;
    manifestVersion?: Uint8Array;
    received?: SdlSecrets;
    sealedSecrets?: string | null;
  }) {
    const signerService = mock<ManagedSignerService>();
    const rpcMessageService = mock<RpcMessageService>();
    const sdlService = mock<SdlService>();
    const billingConfig: MockProxy<BillingConfigService> = mockConfigService<BillingConfigService>({
      DEPLOYMENT_GRANT_DENOM: "uakt",
      TX_SIGNER_REQUEST_TIMEOUT_MS: SIGNER_REQUEST_TIMEOUT_MS
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
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.upsertDefinition.mockResolvedValue(DEPLOYMENT_SETTING_ID);
    const txService = mock<TxService>();
    txService.transaction.mockImplementation(async cb => (input?.transactionRuns === false ? (undefined as never) : await cb()));
    const jobQueueService = mock<JobQueueService>();
    jobQueueService.enqueue.mockResolvedValue(input?.compensationEnqueued === false ? null : COMPENSATION_JOB_ID);
    jobQueueService.hasWaitingSingleton.mockResolvedValue(input?.compensationAlreadyWaiting ?? false);

    const sdlSecretsService = mock<SdlSecretsService>();
    /** Real rather than doubled, because what every stored-sdl assertion below measures is the document this produces. */
    const sdlSecretsDerivationService = new SdlSecretsDerivationService(new SdlReferenceService());
    sdlSecretsService.receive.mockResolvedValue({ ok: true, value: input?.received ?? {} });
    sdlSecretsService.sealForStorage.mockResolvedValue(input?.sealedSecrets ?? null);

    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    sdlService.parse.mockReturnValue({ ok: true, value: parsedSdlValue } as any);
    sdlService.generateManifest.mockResolvedValue({ ok: true, value: manifestValue } as any);
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
      deploymentSettingRepository,
      txService,
      jobQueueService,
      sdlSecretsService,
      sdlSecretsDerivationService,
      new SdlPatchService(),
      new SdlReferenceService()
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
      deploymentSettingRepository,
      txService,
      jobQueueService,
      sdlSecretsService
    };
  }
});
