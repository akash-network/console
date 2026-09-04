import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest, manifestToSortedJSON, yaml } from "@akashnetwork/chain-sdk";
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { BillingConfig } from "@src/billing/providers";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { CreateLogger } from "@src/core";
import type { DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { UserOutput } from "@src/user/repositories";
import { LeaseManifestService } from "./lease-manifest.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const USER_ID = "3f1b6d4e-0000-4000-8000-000000000001";
const DSEQ = "1420000000001";

function sdlWith(env: string[], options: { credentials?: Record<string, string>; gpuModel?: string } = {}) {
  const credentialsBlock = options.credentials
    ? `    credentials:\n${Object.entries(options.credentials)
        .map(([field, value]) => `      ${field}: ${JSON.stringify(value)}\n`)
        .join("")}`
    : "";
  const envBlock = env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("");
  const gpuBlock = options.gpuModel
    ? [
        `        gpu:`,
        `          units: 1`,
        `          attributes:`,
        `            vendor:`,
        `              nvidia:`,
        `                - model: ${options.gpuModel}`
      ].join("\n")
    : "";

  return [
    `version: "2.0"`,
    `services:`,
    `  web:`,
    `    image: nginx`,
    credentialsBlock.replace(/\n$/, ""),
    `    env:`,
    envBlock.replace(/\n$/, ""),
    `profiles:`,
    `  compute:`,
    `    web:`,
    `      resources:`,
    `        cpu:`,
    `          units: 0.1`,
    `        memory:`,
    `          size: 128Mi`,
    `        storage:`,
    `          - size: 128Mi`,
    gpuBlock,
    `  placement:`,
    `    dcloud:`,
    `      pricing:`,
    `        web:`,
    `          denom: uakt`,
    `          amount: 1000`,
    `deployment:`,
    `  web:`,
    `    dcloud:`,
    `      profile: web`,
    `      count: 1`
  ]
    .filter(line => line !== "")
    .join("\n");
}

function manifestOf(sdl: string) {
  const result = generateManifest(yaml.raw<SDLInput>(sdl));

  return manifestToSortedJSON((result as Extract<typeof result, { ok: true }>).value.groups);
}

function aktToUsdRateOf(price: number) {
  return mock<Awaited<ReturnType<DenomExchangeService["getExchangeRateToUSD"]>>>({ price });
}

describe(LeaseManifestService.name, () => {
  describe("deriveFor", () => {
    it("derives the manifest of the sdl the console stored", async () => {
      const stored = sdlWith(["LOG_LEVEL=debug"]);
      const { service } = setup({ definition: { sdl: stored, sealedSecrets: null } });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBe(manifestOf(stored));
    });

    it("resolves the values of the stored token into the manifest", async () => {
      const token = randomUUID();
      const { service } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "sealed" },
        stored: { API_TOKEN: token }
      });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBe(manifestOf(sdlWith([`API_TOKEN=${token}`])));
      expect(manifest).not.toContain("ac-secret://");
    });

    it("resolves a stored registry credential into the manifest", async () => {
      const [username, password] = [randomUUID(), randomUUID()];
      const { service } = setup({
        definition: {
          sdl: sdlWith(["LOG_LEVEL=debug"], {
            credentials: { host: "registry.example.test", username: "ac-secret://REG_USER", password: "ac-secret://REG_PASS" }
          }),
          sealedSecrets: "sealed"
        },
        stored: { REG_USER: username, REG_PASS: password }
      });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBe(manifestOf(sdlWith(["LOG_LEVEL=debug"], { credentials: { host: "registry.example.test", username, password } })));
    });

    it("derives identical bytes from one stored definition twice over", async () => {
      const { service } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN", "LOG_LEVEL=debug"]), sealedSecrets: "sealed" },
        stored: { API_TOKEN: randomUUID() }
      });

      const first = await service.deriveFor({ dseq: DSEQ });
      const second = await service.deriveFor({ dseq: DSEQ });

      expect(first).toBe(second);
      expect(first).toEqual(expect.any(String));
    });

    it("reads the definition of the authenticated user, which no caller can name for it", async () => {
      const { service, scopedRepository } = setup({ definition: { sdl: sdlWith([]), sealedSecrets: null } });

      await service.deriveFor({ dseq: DSEQ });

      expect(scopedRepository.findOneBy).toHaveBeenCalledWith({ userId: USER_ID, dseq: DSEQ });
    });

    it("opens a stored token for the authenticated user rather than for whoever the row names", async () => {
      const { service, sdlSecretsService } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "sealed" },
        stored: { API_TOKEN: "value" }
      });

      await service.deriveFor({ dseq: DSEQ });

      expect(sdlSecretsService.openStored).toHaveBeenCalledWith(expect.objectContaining({ userId: USER_ID }));
    });

    it("reads the definition scoped to the caller's own ability", async () => {
      const { service, deploymentSettingRepository, authService } = setup({ definition: { sdl: sdlWith([]), sealedSecrets: null } });

      await service.deriveFor({ dseq: DSEQ });

      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
    });

    it("opens no stored token for a definition that has none", async () => {
      const { service, sdlSecretsService } = setup({ definition: { sdl: sdlWith(["LOG_LEVEL=debug"]), sealedSecrets: null } });

      await service.deriveFor({ dseq: DSEQ });

      expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
    });

    it("opens the stored token under the deployment it was sealed for", async () => {
      const { service, sdlSecretsService } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "sealed" },
        stored: { API_TOKEN: "value" }
      });

      await service.deriveFor({ dseq: DSEQ });

      expect(sdlSecretsService.openStored).toHaveBeenCalledWith({ userId: USER_ID, dseq: DSEQ, sealedSecrets: "sealed" });
    });

    it("logs what it derived and no part of what it resolved", async () => {
      const token = randomUUID();
      const { service, logger } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN", "LOG_LEVEL=debug"]), sealedSecrets: "sealed" },
        stored: { API_TOKEN: token }
      });

      await service.deriveFor({ dseq: DSEQ });

      expect(logger.info).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_DERIVED", userId: USER_ID, dseq: DSEQ, resolvedSecretCount: 1 });
    });

    it("logs nothing carrying a resolved value, whichever level it logs at", async () => {
      const token = randomUUID();
      const { service, logger } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "sealed" },
        stored: { API_TOKEN: token }
      });

      await service.deriveFor({ dseq: DSEQ });

      expect(JSON.stringify([logger.info.mock.calls, logger.warn.mock.calls, logger.error.mock.calls])).not.toContain(token);
    });

    it("falls back when the console recorded nothing for the deployment", async () => {
      const { service, logger } = setup({ definition: null });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBeNull();
      expect(logger.info).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_FALLBACK", userId: USER_ID, dseq: DSEQ, reason: "nothing-recorded" });
    });

    it("falls back when the row it found carries no sdl", async () => {
      const { service, logger } = setup({ definition: { sdl: null, sealedSecrets: null } });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBeNull();
      expect(logger.info).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_FALLBACK", userId: USER_ID, dseq: DSEQ, reason: "nothing-recorded" });
    });

    it("refuses a row holding a token beside no sdl rather than accepting a client manifest for it", async () => {
      const { service, logger } = setup({ definition: { sdl: null, sealedSecrets: "sealed" } });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toMatchObject({ status: 500 });
      expect(logger.info).not.toHaveBeenCalledWith(expect.objectContaining({ event: "LEASE_MANIFEST_FALLBACK" }));
    });

    it("falls back when a definition carrying no reference will not re-derive", async () => {
      const { service, logger } = setup({ definition: { sdl: "version: '2.0'\nservices: {}", sealedSecrets: null } });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBeNull();
      expect(logger.info).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_FALLBACK", userId: USER_ID, dseq: DSEQ, reason: "unresolvable" });
    });

    it("refuses a definition whose reference has no stored value rather than falling back", async () => {
      const { service } = setup({ definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: null } });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toMatchObject({ status: 500 });
    });

    it("refuses a definition whose token is missing the name its sdl references", async () => {
      const { service } = setup({
        definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "sealed" },
        stored: { SOMETHING_ELSE: "value" }
      });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toMatchObject({ status: 500 });
    });

    it("refuses a stored sdl that will not parse rather than assuming it carries no reference", async () => {
      const { service } = setup({ definition: { sdl: "services:\n  - web\n :::", sealedSecrets: null } });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toMatchObject({ status: 500 });
    });

    it("refuses a sealed definition that will not re-derive even with no reference left in its sdl", async () => {
      const { service } = setup({ definition: { sdl: "version: '2.0'\nservices: {}", sealedSecrets: "sealed" }, stored: {} });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toMatchObject({ status: 500 });
    });

    it("says nothing of the definition in the refusal it reports", async () => {
      const token = randomUUID();
      const { service } = setup({ definition: { sdl: sdlWith([`API_TOKEN=ac-secret://${token.replace(/-/g, "_")}`]), sealedSecrets: null } });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toMatchObject({ message: "Unable to derive the deployment manifest" });
    });

    it("logs the refusal so a definition nothing can re-derive is measurable", async () => {
      const { service, logger } = setup({ definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: null } });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_UNRESOLVABLE", userId: USER_ID, dseq: DSEQ });
    });

    it("lets a token it cannot open fail the derivation untouched", async () => {
      const unreadable = Object.assign(new Error("Unable to read the stored value"), { status: 500 });
      const { service, sdlSecretsService } = setup({ definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "tampered" } });
      sdlSecretsService.openStored.mockRejectedValue(unreadable);

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toBe(unreadable);
    });

    it("logs a token it cannot open as the lease failure it is, not only as the cipher's", async () => {
      const { service, sdlSecretsService, logger } = setup({ definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: "tampered" } });
      sdlSecretsService.openStored.mockRejectedValue(Object.assign(new Error("Unable to read the stored value"), { status: 500 }));

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_UNRESOLVABLE", userId: USER_ID, dseq: DSEQ });
    });

    it("writes nothing to the row it read, whatever the derivation makes of it", async () => {
      const { service, deploymentSettingRepository } = setup({ definition: { sdl: sdlWith(["API_TOKEN=ac-secret://API_TOKEN"]), sealedSecrets: null } });

      await expect(service.deriveFor({ dseq: DSEQ })).rejects.toThrow();

      expect(deploymentSettingRepository.upsertDefinition).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.updateById).not.toHaveBeenCalled();
      expect(deploymentSettingRepository.markClosed).not.toHaveBeenCalled();
    });

    it("derives a gpu the trial rules block, because the create it belongs to already cleared it", async () => {
      const stored = sdlWith(["LOG_LEVEL=debug"], { gpuModel: "a100" });
      const { service } = setup({ definition: { sdl: stored, sealedSecrets: null }, blockedGpuModels: ["nvidia/a100"] });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBe(manifestOf(stored));
    });

    it("derives resources above the trial ceilings, because the create it belongs to already cleared them", async () => {
      const stored = sdlWith(["LOG_LEVEL=debug"]);
      const { service } = setup({ definition: { sdl: stored, sealedSecrets: null }, trialMaxCpu: 0.05, trialMaxMemoryGi: 0.01 });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBe(manifestOf(stored));
    });

    it("derives the same bytes twice over however the akt price the grant denom restates through moves between them", async () => {
      const stored = sdlWith(["LOG_LEVEL=debug"]);
      const { service, denomExchangeService } = setup({ definition: { sdl: stored, sealedSecrets: null }, grantDenom: "uact" });
      denomExchangeService.getExchangeRateToUSD.mockResolvedValueOnce(aktToUsdRateOf(0.325)).mockResolvedValueOnce(aktToUsdRateOf(9));

      const first = await service.deriveFor({ dseq: DSEQ });
      const second = await service.deriveFor({ dseq: DSEQ });

      expect(first).toBe(second);
      expect(first).toBe(manifestOf(stored));
    });

    it("falls back when the akt price the grant denom restatement needs is unavailable", async () => {
      const { service, logger } = setup({
        definition: { sdl: sdlWith(["LOG_LEVEL=debug"]), sealedSecrets: null },
        grantDenom: "uact",
        aktToUsdRate: 0
      });

      const manifest = await service.deriveFor({ dseq: DSEQ });

      expect(manifest).toBeNull();
      expect(logger.info).toHaveBeenCalledWith({ event: "LEASE_MANIFEST_FALLBACK", userId: USER_ID, dseq: DSEQ, reason: "unresolvable" });
    });
  });

  function setup(input: {
    definition?: { sdl: string | null; sealedSecrets: string | null } | null;
    stored?: Record<string, string>;
    blockedGpuModels?: string[];
    trialMaxCpu?: number;
    trialMaxMemoryGi?: number;
    grantDenom?: BillingConfig["DEPLOYMENT_GRANT_DENOM"];
    aktToUsdRate?: number;
  }) {
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    const scopedRepository = mock<DeploymentSettingRepository>();
    const authService = mock<AuthService>({ currentUser: mock<UserOutput>({ id: USER_ID }) });
    const sdlSecretsService = mock<SdlSecretsService>({ openStored: vi.fn().mockResolvedValue(input.stored ?? {}) });
    const logger = mock<ReturnType<CreateLogger>>();

    deploymentSettingRepository.accessibleBy.mockReturnValue(scopedRepository);
    scopedRepository.findOneBy.mockResolvedValue(
      input.definition ? mock<DeploymentSettingsOutput>({ sdl: input.definition.sdl, sealedSecrets: input.definition.sealedSecrets }) : undefined
    );

    const createLogger: CreateLogger = () => logger;
    const denomExchangeService = mock<DenomExchangeService>({
      getExchangeRateToUSD: vi.fn().mockResolvedValue(aktToUsdRateOf(input.aktToUsdRate ?? 1))
    });

    const sdlReferenceService = new SdlReferenceService();
    const sdlService = new SdlService(
      mock<BillingConfig>({
        DEPLOYMENT_GRANT_DENOM: input.grantDenom ?? "uakt",
        MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: [],
        MANAGED_WALLET_TRIAL_MAX_CPU: input.trialMaxCpu ?? 0,
        MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: input.trialMaxMemoryGi ?? 0
      }),
      new BlockedGpuService(mockConfigService<BillingConfigService>({ MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: input.blockedGpuModels ?? [] })),
      sdlReferenceService,
      denomExchangeService,
      createLogger
    );

    const service = new LeaseManifestService(deploymentSettingRepository, authService, sdlSecretsService, sdlReferenceService, sdlService, createLogger);

    return { service, deploymentSettingRepository, scopedRepository, authService, sdlSecretsService, sdlService, denomExchangeService, logger };
  }
});
