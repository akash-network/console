import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import { yaml } from "@akashnetwork/chain-sdk";
import type { AnyAbility } from "@casl/ability";
import createError from "http-errors";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { WalletInitialized } from "@src/billing/repositories";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentReaderService } from "@src/deployment/services/deployment-reader/deployment-reader.service";
import type { SdlManifest, SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import { SdlSecretsDerivationService } from "@src/deployment/services/sdl-secrets-derivation/sdl-secrets-derivation.service";
import type { SdlSecretsInheritanceService } from "@src/deployment/services/sdl-secrets-inheritance/sdl-secrets-inheritance.service";
import type { OnChainGroupSpec } from "@src/deployment/utils/changed-group-resources/changed-group-resources";
import { DeploymentDefinitionCheckService } from "./deployment-definition-check.service";

import { createDeploymentInfoGroupSeed } from "@test/seeders/deployment-info.seeder";

const DSEQ = "1234";
const STORED_TOKEN = "stored.token.aaa.bbb.ccc";

function oversizedEnv() {
  return Array.from({ length: 30 }, (_, index) => `VALUE_${index}=${"x".repeat(5_000)}`);
}

function sdlWith(env: string[]) {
  return ['version: "2.0"', "services:", "  web:", "    image: nginx", "    env:", ...env.map(entry => `      - ${JSON.stringify(entry)}`), ""].join("\n");
}

describe(DeploymentDefinitionCheckService.name, () => {
  describe("checkNew", () => {
    it("answers valid with nothing kept for a definition a create would take", async () => {
      const { service } = setup();

      await expect(service.checkNew("user-1", { sdl: sdlWith(["MODE=production"]), secretEnv: [] })).resolves.toEqual({
        valid: true,
        errors: [],
        keptSecrets: []
      });
    });

    it("answers only the parse errors of a document that does not parse", async () => {
      const { service, sdlService } = setup();

      const result = await service.checkNew("user-1", { sdl: "services: [" });

      expect(result).toEqual({ valid: false, errors: [{ path: "", keyword: "yaml", message: expect.any(String) }], keptSecrets: [] });
      expect(sdlService.generateManifestFrom).not.toHaveBeenCalled();
    });

    it("reports reference, manifest, secretEnv and intake errors together", async () => {
      const { service } = setup({
        manifestErrors: [{ schemaPath: "", instancePath: "/services/web", keyword: "required", params: {}, message: "must have required property 'expose'" }],
        receiveErrors: [{ schemaPath: "", instancePath: "/services/web/env/1", keyword: "sdl-reference", params: {}, message: "no value supplied" }]
      });

      const result = await service.checkNew("user-1", { sdl: sdlWith(["MODE=ac-oops", "KEY=ac-secret://KEY"]), secretEnv: ["MISSPELT"] });

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([
        { path: "/services/web/env/0", keyword: "sdl-reference", message: expect.stringContaining("ac-oops") },
        { path: "/services/web", keyword: "required", message: "must have required property 'expose'" },
        { path: "/secretEnv", keyword: "secretEnv", message: '"MISSPELT" is listed in secretEnv, but the request sets no environment variable of that name' },
        { path: "/services/web/env/1", keyword: "sdl-reference", message: "no value supplied" }
      ]);
    });

    it("reports a definition that exposes nothing globally", async () => {
      const { service } = setup({ exposesGlobally: false });

      const result = await service.checkNew("user-1", { sdl: sdlWith([]), secretEnv: [] });

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
    });

    it("validates the manifest under the wallet's trial limits without touching the document", async () => {
      const { service, sdlService } = setup({ isTrialing: true });

      await service.checkNew("user-1", { sdl: sdlWith(["MODE=production"]) });

      expect(sdlService.generateManifestFrom).toHaveBeenCalledWith(yaml.raw<SDLInput>(sdlWith(["MODE=production"])), { isTrialing: true });
    });

    it("answers references from the deployment it inherits from and lists them as kept", async () => {
      const { service, sdlSecretsService, sdlSecretsInheritanceService, wallet } = setup({ inherited: { KEY: "value", OTHER: "unused" } });

      const result = await service.checkNew("user-1", { sdl: sdlWith(["KEY=ac-secret://KEY"]), inheritSecretsFrom: "999" });

      expect(sdlSecretsInheritanceService.open).toHaveBeenCalledWith({ wallet, dseq: "999" });
      expect(sdlSecretsService.receive).toHaveBeenCalledWith(expect.objectContaining({ inherited: { KEY: "value", OTHER: "unused" } }));
      expect(result.keptSecrets).toEqual(["KEY"]);
    });

    it("does not list a reference the request supplies as kept", async () => {
      const { service } = setup({ inherited: { KEY: "old" }, received: { KEY: "new" } });

      const result = await service.checkNew("user-1", { sdl: sdlWith(["KEY=ac-secret://KEY"]), sealedSecrets: "client.seal", inheritSecretsFrom: "999" });

      expect(result.keptSecrets).toEqual([]);
    });

    it("bounds only what a create carries in, as the create does, leaving derived values unbounded", async () => {
      const { service, sdlSecretsService } = setup({ inherited: { KEY: "value", OTHER: "unused" }, maxCount: 1 });

      const result = await service.checkNew("user-1", { sdl: sdlWith(["KEY=ac-secret://KEY", "MODE=production"]), inheritSecretsFrom: "999" });

      expect(sdlSecretsService.assertStorable).toHaveBeenCalledTimes(1);
      expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({ KEY: "value" }, "carried");
      expect(result).toEqual({ valid: true, errors: [], keptSecrets: ["KEY"] });
    });

    it("reports a carried set a create would refuse", async () => {
      const { service } = setup({ inherited: { KEY: "value", OTHER: "value" }, maxCount: 1 });

      const result = await service.checkNew("user-1", { sdl: sdlWith(["KEY=ac-secret://KEY", "OTHER=ac-secret://OTHER"]), inheritSecretsFrom: "999" });

      expect(result.errors).toEqual([{ path: "", keyword: "secrets", message: "At most 1 secrets may be carried" }]);
    });

    it("reports a document too large to store once the values it keeps in the clear stay in it", async () => {
      const { service } = setup();

      const result = await service.checkNew("user-1", { sdl: sdlWith(oversizedEnv()), secretEnv: [] });

      expect(result).toEqual({
        valid: false,
        errors: [{ path: "", keyword: "maxLength", message: "SDL is too large: it exceeds the maximum of 131072 characters once stored" }],
        keptSecrets: []
      });
    });

    it("measures the document after its values are taken out of it, as a create does", async () => {
      const { service } = setup();

      await expect(service.checkNew("user-1", { sdl: sdlWith(oversizedEnv()) })).resolves.toEqual({ valid: true, errors: [], keptSecrets: [] });
    });

    it("measures an anchored document by what it expands to once stored", async () => {
      const { service } = setup();
      const anchored = [
        'version: "2.0"',
        "services:",
        "  web:",
        "    image: nginx",
        "    env: &env",
        `      - "VALUE=${"x".repeat(70_000)}"`,
        "  api:",
        "    image: nginx",
        "    env: *env",
        ""
      ].join("\n");

      const result = await service.checkNew("user-1", { sdl: anchored, secretEnv: [] });

      expect(result.errors).toEqual([expect.objectContaining({ keyword: "maxLength" })]);
    });

    it("lets an unexpected failure of the bound through", async () => {
      const { service, sdlSecretsService } = setup();
      sdlSecretsService.assertStorable.mockImplementation(() => {
        throw new Error("boom");
      });

      await expect(service.checkNew("user-1", { sdl: sdlWith([]) })).rejects.toThrow("boom");
    });
  });

  describe("checkReplacement", () => {
    it("opens the stored secrets under the row's organization and lists the references they answer", async () => {
      const { service, sdlSecretsService, ability } = setup({ stored: { sdl: sdlWith(["KEY=ac-secret://KEY"]), held: { KEY: "value" } } });

      const result = await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith(["KEY=ac-secret://KEY", "MODE=production"]), secretEnv: [] }, ability);

      expect(sdlSecretsService.openStored).toHaveBeenCalledWith({
        userId: "user-1",
        organizationId: "organization-1",
        dseq: DSEQ,
        sealedSecrets: STORED_TOKEN
      });
      expect(result).toEqual({ valid: true, errors: [], keptSecrets: ["KEY"] });
    });

    it("opens nothing for a deployment that stores no token", async () => {
      const { service, sdlSecretsService, ability } = setup({ stored: { sdl: sdlWith(["MODE=production"]), token: null } });

      await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith(["MODE=production"]) }, ability);

      expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
    });

    it("counts a plain value left as stored as readable, as the replacement would", async () => {
      const { service, sdlSecretsService, ability } = setup({ stored: { sdl: sdlWith(["MODE=production"]), token: null } });

      await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith(["MODE=production", "ADDED=value"]) }, ability);

      expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({}, "carried");
      expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({ s0_e1: "value" }, "stored");
    });

    it("leaves a held value the replacement derives anew out of the carried set", async () => {
      const { service, sdlSecretsService, ability } = setup({ stored: { sdl: sdlWith(["MODE=ac-secret://s0_e0"]), held: { s0_e0: "old" } } });

      await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith(["MODE=new"]) }, ability);

      expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({}, "carried");
      expect(sdlSecretsService.assertStorable).toHaveBeenCalledWith({ s0_e0: "new" }, "stored");
    });

    it("reports a stored set the replacement would refuse once its carried set passes", async () => {
      const { service, ability } = setup({ stored: { sdl: sdlWith(["KEY=ac-secret://KEY"]), held: { KEY: "value" } }, maxCount: 1 });

      const result = await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith(["KEY=ac-secret://KEY", "ADDED=value"]) }, ability);

      expect(result.errors).toEqual([{ path: "", keyword: "secrets", message: "At most 1 secrets may be stored" }]);
    });

    it("reports only the carried refusal when both sets are too large, as the replacement stops at it", async () => {
      const { service, ability } = setup({ stored: { sdl: sdlWith(["A=ac-secret://A", "B=ac-secret://B"]), held: { A: "a", B: "b" } }, maxCount: 1 });

      const result = await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith(["A=ac-secret://A", "B=ac-secret://B", "ADDED=value"]) }, ability);

      expect(result.errors).toEqual([{ path: "", keyword: "secrets", message: "At most 1 secrets may be carried" }]);
    });

    it("reports a change only a new deployment can take", async () => {
      const { service, ability } = setup({
        stored: { sdl: sdlWith([]) },
        onChainGroupSpecs: [{ ...createDeploymentInfoGroupSeed({ name: "other-group" }).group_spec, resources: [] }]
      });

      const result = await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith([]) }, ability);

      expect(result.errors).toEqual([{ path: "/deployment", keyword: "deployment_resources_changed", message: expect.stringContaining('"other-group"') }]);
    });

    it("skips the resource check for a deployment the chain could not describe", async () => {
      const { service, ability } = setup({ stored: { sdl: sdlWith([]) }, onChainGroupSpecs: null });

      await expect(service.checkReplacement("user-1", DSEQ, { sdl: sdlWith([]) }, ability)).resolves.toMatchObject({ valid: true });
    });

    it("skips the resource check when the manifest itself is invalid", async () => {
      const { service, deploymentReaderService, ability } = setup({
        stored: { sdl: sdlWith([]) },
        manifestErrors: [{ schemaPath: "", instancePath: "/profiles", keyword: "required", params: {}, message: "missing" }]
      });

      await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith([]) }, ability);

      expect(deploymentReaderService.findWithGroupSpecsByWalletAndDseq).not.toHaveBeenCalled();
    });

    it("answers 404 when the console recorded no sdl for the deployment", async () => {
      const { service, ability } = setup({ stored: null });

      await expect(service.checkReplacement("user-1", DSEQ, { sdl: sdlWith([]) }, ability)).rejects.toMatchObject({ status: 404 });
    });

    it("answers 500 when the recorded sdl does not parse", async () => {
      const { service, ability } = setup({ stored: { sdl: "services: [" } });

      await expect(service.checkReplacement("user-1", DSEQ, { sdl: sdlWith([]) }, ability)).rejects.toMatchObject({
        status: 500,
        errorCode: "stored_sdl_unreadable"
      });
    });

    it("reads the definition filed for the deployment, under the caller's ability", async () => {
      const { service, deploymentSettingRepository, signerService, ability } = setup({ stored: { sdl: sdlWith([]) } });
      signerService.filedUserIdOf.mockResolvedValue("filer-1");

      await service.checkReplacement("user-1", DSEQ, { sdl: sdlWith([]) }, ability);

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
    });
  });

  function setup(input?: {
    isTrialing?: boolean;
    manifestErrors?: ValidationError[];
    receiveErrors?: ValidationError[];
    received?: Record<string, string>;
    inherited?: Record<string, string>;
    maxCount?: number;
    exposesGlobally?: boolean;
    stored?: { sdl: string; token?: string | null; held?: Record<string, string> } | null;
    onChainGroupSpecs?: OnChainGroupSpec[] | null;
  }) {
    const wallet = mock<WalletInitialized>({ id: 7, address: "akash1owner", isTrialing: input?.isTrialing ?? false });
    const walletReaderService = mock<WalletReaderService>();
    walletReaderService.getWalletByUserId.mockResolvedValue(wallet);
    const signerService = mock<ManagedSignerService>();
    signerService.filedUserIdOf.mockImplementation(async (_wallet, actingUserId) => actingUserId);

    const scoped = mock<DeploymentSettingRepository>();
    const stored = input?.stored;
    scoped.findOneBy.mockResolvedValue(
      stored === null
        ? undefined
        : mock<DeploymentSettingsOutput>({
            sdl: stored?.sdl ?? sdlWith([]),
            sealedSecrets: stored?.token === undefined ? STORED_TOKEN : stored.token,
            organizationId: "organization-1"
          })
    );
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.accessibleBy.mockReturnValue(scoped);

    const deploymentReaderService = mock<DeploymentReaderService>();
    deploymentReaderService.findWithGroupSpecsByWalletAndDseq.mockResolvedValue({
      deployment: mock(),
      groupSpecs: input?.onChainGroupSpecs === undefined ? [] : input.onChainGroupSpecs
    });

    const sdlService = mock<SdlService>();
    sdlService.parse.mockImplementation(raw => {
      try {
        return { ok: true, value: yaml.raw<SDLInput>(raw) };
      } catch (error) {
        return { ok: false, value: [{ schemaPath: "", instancePath: "", keyword: "yaml", params: {}, message: (error as Error).message }] };
      }
    });
    sdlService.generateManifestFrom.mockResolvedValue(
      input?.manifestErrors
        ? { ok: false, value: input.manifestErrors }
        : {
            ok: true,
            value: mock<SdlManifest>({
              groups: [{ name: "checked-group", services: [{ name: "web", expose: [{ global: input?.exposesGlobally ?? true }] }] }],
              groupSpecs: []
            })
          }
    );

    const sdlSecretsService = mock<SdlSecretsService>();
    sdlSecretsService.receive.mockResolvedValue(input?.receiveErrors ? { ok: false, value: input.receiveErrors } : { ok: true, value: input?.received ?? {} });
    sdlSecretsService.openStored.mockResolvedValue(stored?.held ?? {});
    const maxCount = input?.maxCount;
    sdlSecretsService.assertStorable.mockImplementation((secrets, origin) => {
      if (maxCount !== undefined && Object.keys(secrets).length > maxCount) throw createError(400, `At most ${maxCount} secrets may be ${origin}`);
    });

    const sdlSecretsInheritanceService = mock<SdlSecretsInheritanceService>();
    sdlSecretsInheritanceService.open.mockResolvedValue(input?.inherited ?? {});

    const sdlReferenceService = new SdlReferenceService();
    const service = new DeploymentDefinitionCheckService(
      walletReaderService,
      signerService,
      deploymentSettingRepository,
      deploymentReaderService,
      sdlService,
      sdlReferenceService,
      sdlSecretsService,
      new SdlSecretsDerivationService(sdlReferenceService),
      sdlSecretsInheritanceService
    );

    return {
      service,
      wallet,
      ability: mock<AnyAbility>(),
      signerService,
      deploymentSettingRepository,
      deploymentReaderService,
      sdlService,
      sdlSecretsService,
      sdlSecretsInheritanceService
    };
  }
});
