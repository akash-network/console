import type { SDLInput } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { WalletInitialized } from "@src/billing/repositories";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { RpcMessageService } from "@src/billing/services/rpc-message-service/rpc-message.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { CreateLogger } from "@src/core";
import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { GenerateResolvedManifestResult, SdlManifest, SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlPatchService } from "@src/deployment/services/sdl-patch/sdl-patch.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import type { ProviderService } from "@src/provider/services/provider/provider.service";
import { SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import { DeploymentPatchService } from "./deployment-patch.service";

const CLIENT_SEAL = "client.seal.aaa.bbb.ccc";

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

describe(DeploymentPatchService.name, () => {
  describe("a plaintext value the patch never named", () => {
    it("leaves an untouched service's plaintext env value in the clear", async () => {
      const { service, deploymentSettingRepository } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

      const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
      expect(sdl).toContain("LOG_LEVEL=debug");
    });

    it("does not pull an untouched service's value into the token", async () => {
      const { service, sealedFor } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

      expect(sealedFor()).toEqual({ s0_e0: "token" });
    });

    it("leaves a plaintext value in the very service it patched, when the patch did not name that variable", async () => {
      const { service, deploymentSettingRepository } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { worker: { image: "busybox:1.36" } } });

      const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
      expect(sdl).toContain("LOG_LEVEL=debug");
    });

    it("seals a value the patch does write, in that same service", async () => {
      const { service, sealedFor, deploymentSettingRepository } = setup({ sdl: STORED_SDL_WITH_PLAINTEXT, held: { s0_e0: "token" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { worker: { env: { LOG_LEVEL: "trace" } } } });

      const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
      expect(sdl).not.toContain("LOG_LEVEL=trace");
      expect(sdl).toContain("LOG_LEVEL=ac-secret://s1_e0");
      expect(sealedFor()).toEqual({ s0_e0: "token", s1_e0: "trace" });
    });
  });

  describe("the name a re-supplied value ends up stored under", () => {
    it("gives a patched variable a different derived name, since names need only be unique", async () => {
      const { service, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } });

      const names = Object.keys(sealedFor());
      expect(names).not.toContain("s0_e0");
      expect(Object.values(sealedFor())).toEqual(expect.arrayContaining(["rotated", "kept"]));
    });

    it("drops the name the value used to be stored under from the re-sealed token", async () => {
      const { service, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } });

      expect(sealedFor()).not.toHaveProperty("s0_e0");
    });

    it("keeps the value of every variable the patch did not name, whatever name it now sits under", async () => {
      const { service, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } });

      expect(Object.values(sealedFor())).toContain("kept");
    });

    it("records an sdl whose references all resolve against the re-sealed token", async () => {
      const { service, sealedFor, deploymentSettingRepository, sdlReferenceService } = setup({ held: { s0_e0: "token", s0_e1: "kept" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { API_TOKEN: "rotated" } } } });

      const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
      const document = yaml.raw<SDLInput>(sdl);
      expect(sdlReferenceService.substitute(document, { secrets: sealedFor() })).toEqual([]);
    });
  });

  describe("the size of the set it would store", () => {
    it("refuses when the merged set exceeds the count a deployment may carry", async () => {
      const held = Object.fromEntries(Array.from({ length: 2 }, (_, index) => [`s0_e${index}`, "value"]));
      const { service } = setup({ held, maxCount: 1 });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toMatchObject({ status: 400 });
    });

    it("measures what it would store, not merely what the request supplied", async () => {
      const { service, sdlSecretsService } = setup({ held: { s0_e0: "a", s0_e1: "b" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } });

      expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({ s0_e0: "a", s0_e1: "b" });
    });

    it("writes nothing when the merged set is refused", async () => {
      const { service, deploymentSettingRepository } = setup({ held: { s0_e0: "a", s0_e1: "b" }, maxCount: 1 });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toThrow();
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });
  });

  describe("a supplied name the patched sdl does not reference", () => {
    it("refuses it rather than dropping it, naming the name", async () => {
      const { service } = setup({ held: { s0_e0: "a" }, supplied: { s0_eTYPO: "rotated" } });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, sealedSecrets: CLIENT_SEAL })).rejects.toThrow(
        /s0_eTYPO/
      );
    });

    it("answers 400", async () => {
      const { service } = setup({ held: { s0_e0: "a" }, supplied: { s0_eTYPO: "rotated" } });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, sealedSecrets: CLIENT_SEAL })).rejects.toMatchObject({
        status: 400
      });
    });

    it("writes nothing", async () => {
      const { service, deploymentSettingRepository } = setup({ held: { s0_e0: "a" }, supplied: { s0_eTYPO: "rotated" } });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, sealedSecrets: CLIENT_SEAL })).rejects.toThrow();
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });

    it("still drops a stored name the patched sdl stopped referencing, without complaint", async () => {
      const { service, sealedFor } = setup({ held: { s0_e0: "kept", s0_e1: "orphan" } });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { DATABASE_URL: null } } } });

      expect(sealedFor()).toEqual({ s0_e0: "kept" });
    });
  });

  it("patches the sdl the console stored rather than one the request carries", async () => {
    const { service, deploymentSettingRepository } = setup();

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

    expect(deploymentSettingRepository.findOneBy).toHaveBeenCalledWith({ userId: "user-1", dseq: "1234" });
  });

  it("records the patched document, carrying the new image", async () => {
    const { service, deploymentSettingRepository } = setup();

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

    expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).toHaveBeenCalledWith(
      expect.objectContaining({ sdl: expect.stringContaining("nginx:1.27") })
    );
  });

  it("keeps every stored value the patched sdl still references", async () => {
    const { service, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "postgres://db" } });

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

    expect(sealedFor()).toEqual({ s0_e0: "token", s0_e1: "postgres://db" });
  });

  it("overlays a supplied value over the stored one under the same name", async () => {
    const { service, sealedFor } = setup({ held: { s0_e0: "old", s0_e1: "kept" }, supplied: { s0_e0: "rotated" } });

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: {} }, sealedSecrets: CLIENT_SEAL });

    expect(sealedFor()).toEqual({ s0_e0: "rotated", s0_e1: "kept" });
  });

  it("drops a name the patched sdl no longer references", async () => {
    const { service, sealedFor } = setup({ held: { s0_e0: "token", s0_e1: "dropped" } });

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { env: { DATABASE_URL: null } } } });

    expect(sealedFor()).toEqual({ s0_e0: "token" });
  });

  it("opens the stored token exactly once however many secrets change", async () => {
    const { service, sdlSecretsService } = setup({ held: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`s0_e${i}`, `v${i}`])) });

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

    expect(sdlSecretsService.openStored).toHaveBeenCalledTimes(1);
  });

  it("seals the merged set exactly once", async () => {
    const { service, sdlSecretsService } = setup({ held: { s0_e0: "a", s0_e1: "b" }, supplied: { s0_e0: "c" } });

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

    expect(sdlSecretsService.sealForStorage).toHaveBeenCalledTimes(1);
  });

  it("reaches no key service at all when the deployment holds no token and the patch supplies none", async () => {
    const { service, sdlSecretsService } = setup({ storedToken: null, sdl: STORED_SDL.replace(/ *- API_TOKEN.*\n/, "").replace(/ *- DATABASE_URL.*\n/, "") });

    await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

    expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
    expect(sdlSecretsService.receiveForMerge).not.toHaveBeenCalled();
  });

  describe("a refusal", () => {
    it("answers 404 for a deployment the console recorded no sdl for", async () => {
      const { service } = setup({ setting: undefined });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toMatchObject({ status: 404 });
    });

    it("writes nothing when the patch names a service the sdl does not declare", async () => {
      const { service, deploymentSettingRepository } = setup();

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { api: { image: "x" } } })).rejects.toMatchObject({ status: 400 });
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });

    it("spends no key-service call on a patch it refuses structurally", async () => {
      const { service, sdlSecretsService } = setup({ held: { s0_e0: "a" } });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { api: { image: "x" } } })).rejects.toThrow();
      expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
      expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
    });

    it("answers 400 naming the reference it holds no value for", async () => {
      const { service } = setup({
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

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toThrow(/ac-secret:\/\/s0_e0/);
    });

    it("writes nothing when a reference resolves to no value", async () => {
      const { service, deploymentSettingRepository } = setup({
        held: {},
        resolveErrors: [{ schemaPath: "", instancePath: "", keyword: "sdl-reference", params: {}, message: "no value" }]
      });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toThrow();
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });

    it("answers 409 when the version the patch expected is no longer current", async () => {
      const { service } = setup({ written: undefined });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, ifManifestVersion: "STALE" })).rejects.toMatchObject({
        status: 409
      });
    });

    it("sends no manifest to any provider when the write is refused", async () => {
      const { service, providerService } = setup({ written: undefined });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } }, ifManifestVersion: "STALE" })).rejects.toThrow();
      expect(providerService.sendManifest).not.toHaveBeenCalled();
    });
  });

  describe("stored state the console cannot read or store back", () => {
    it("answers a permanent 5xx when the recorded sdl will not parse", async () => {
      const { service } = setup({ sdl: "services: [this is not: valid: yaml" });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toMatchObject({
        status: 500,
        errorCode: "stored_sdl_unreadable"
      });
    });

    it("writes nothing when the recorded sdl will not parse", async () => {
      const { service, deploymentSettingRepository } = setup({ sdl: "services: [this is not: valid: yaml" });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toThrow();
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });

    it("refuses a patched document too large to store, naming the bound", async () => {
      const { service } = setup({ held: {}, sdl: STORED_SDL });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "n".repeat(SDL_MAX_LENGTH + 1) } } })).rejects.toMatchObject({
        status: 400
      });
    });

    it("writes nothing when the patched document is too large to store", async () => {
      const { service, deploymentSettingRepository } = setup({ held: {}, sdl: STORED_SDL });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "n".repeat(SDL_MAX_LENGTH + 1) } } })).rejects.toThrow();
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });
  });

  describe("a stored token that will not open", () => {
    it("fails with the permanent 5xx rather than a retryable one", async () => {
      const { service } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toMatchObject({
        status: 500,
        message: SECRET_UNREADABLE_ERROR_MESSAGE
      });
    });

    it("never overwrites the token it could not read", async () => {
      const { service, deploymentSettingRepository } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toThrow();
      expect(deploymentSettingRepository.replaceDefinitionIfVersionMatches).not.toHaveBeenCalled();
    });

    it("re-seals nothing", async () => {
      const { service, sdlSecretsService } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toThrow();
      expect(sdlSecretsService.sealForStorage).not.toHaveBeenCalled();
    });

    it("keeps a key service that is merely unreachable answering its retryable status", async () => {
      const { service } = setup({ openStoredError: createError(503, "Service temporarily unavailable") });

      await expect(service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } })).rejects.toMatchObject({ status: 503 });
    });
  });

  describe("what it commits and pushes", () => {
    it("broadcasts an update when the patched manifest version differs from the chain's", async () => {
      const { service, signerService } = setup({ chainHash: "SOMETHING_ELSE" });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } });

      expect(signerService.executeDerivedDecodedTxByUserId).toHaveBeenCalledTimes(1);
    });

    it("broadcasts nothing when the chain already holds the patched version", async () => {
      const { service, signerService } = setup({ chainHash: Buffer.from(new Uint8Array([1, 2, 3])).toString("base64") });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } });

      expect(signerService.executeDerivedDecodedTxByUserId).not.toHaveBeenCalled();
    });

    it("sends the resolved manifest to each lease provider once", async () => {
      const { service, providerService } = setup({ providers: ["akash1provider", "akash1other"] });

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } });

      expect(providerService.sendManifest).toHaveBeenCalledTimes(2);
    });

    it("returns the manifest version it recorded", async () => {
      const { service } = setup();

      const result = await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "x" } } });

      expect(result.manifestVersion).toBe(Buffer.from(new Uint8Array([1, 2, 3])).toString("base64"));
    });

    it("resolves the very bytes it recorded", async () => {
      const { service, sdlService, deploymentSettingRepository } = setup();

      await service.patchByUserIdAndDseq("user-1", "1234", { services: { web: { image: "nginx:1.27" } } });

      const [{ sdl }] = vi.mocked(deploymentSettingRepository.replaceDefinitionIfVersionMatches).mock.calls[0];
      expect(sdlService.generateResolvedManifest).toHaveBeenCalledWith(expect.objectContaining({ sdl }));
    });
  });

  function setup(input?: {
    sdl?: string;
    setting?: DeploymentSettingsOutput | undefined;
    storedToken?: string | null;
    held?: Record<string, string>;
    supplied?: Record<string, string>;
    resolveErrors?: Array<{ schemaPath: string; instancePath: string; keyword: string; params: Record<string, unknown>; message: string }>;
    maxCount?: number;
    written?: string | undefined;
    chainHash?: string;
    providers?: string[];
    openStoredError?: Error;
  }) {
    const manifestVersion = new Uint8Array([1, 2, 3]);
    const storedToken = input?.storedToken === undefined ? "stored.token.aaa.bbb.ccc" : input.storedToken;
    const hasSetting = !("setting" in (input ?? {})) || input?.setting !== undefined;

    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletByUserId.mockResolvedValue(mock<WalletInitialized>({ id: 7, userId: "user-1", address: "akash1owner", isTrialing: false }));

    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const scoped = mock<DeploymentSettingRepository>();
    scoped.findOneBy.mockResolvedValue(hasSetting ? mock<DeploymentSettingsOutput>({ sdl: input?.sdl ?? STORED_SDL, sealedSecrets: storedToken }) : undefined);
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
    const service = new DeploymentPatchService(
      walletReaderService,
      deploymentReaderService,
      deploymentSettingRepository,
      mock<AuthService>(),
      new SdlPatchService(),
      sdlService,
      sdlReferenceService,
      sdlSecretsService,
      new SdlSecretsDerivationService(new SdlReferenceService()),
      signerService,
      mock<RpcMessageService>(),
      providerService,
      createLogger
    );

    function sealedFor() {
      return vi.mocked(sdlSecretsService.sealForStorage).mock.calls[0][0].secrets;
    }

    return {
      service,
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
