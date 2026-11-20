import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput } from "@src/billing/repositories";
import type { ManagedSignerService } from "@src/billing/services/managed-signer/managed-signer.service";
import type { WalletReaderService } from "@src/billing/services/wallet-reader/wallet-reader.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentSettingRepository, DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { DeploymentSecretsReaderService } from "./deployment-secrets-reader.service";

import { createOrganizationWallet } from "@test/seeders/user-wallet.seeder";

describe(DeploymentSecretsReaderService.name, () => {
  describe("listByUserIdAndDseq", () => {
    it("lists each secret once by name, sorted, with every place it is used", async () => {
      const { service } = setup({
        sdl: sdlOf(
          serviceYaml("web", { env: ["PORT=8080", "TOKEN=ac-secret://TOKEN", "DB_URL=ac-secret://DB_URL"], credentials: { password: "ac-secret://REGISTRY" } }),
          serviceYaml("worker", { env: ["API_TOKEN=ac-secret://TOKEN"] })
        )
      });

      const result = await service.listByUserIdAndDseq(faker.string.uuid(), "1234");

      expect(result).toEqual({
        secrets: [
          { name: "DB_URL", usedBy: [{ service: "web", env: "DB_URL" }] },
          { name: "REGISTRY", usedBy: [{ service: "web", credential: "password" }] },
          {
            name: "TOKEN",
            usedBy: [
              { service: "web", env: "TOKEN" },
              { service: "worker", env: "API_TOKEN" }
            ]
          }
        ]
      });
    });

    it("lists names the console minted when it sealed values on its own", async () => {
      const { service } = setup({
        sdl: sdlOf(serviceYaml("web", { env: ["MODE=ac-secret://s0_e1"], credentials: { username: "ac-secret://s0_c_username" } }))
      });

      const result = await service.listByUserIdAndDseq(faker.string.uuid(), "1234");

      expect(result.secrets).toEqual([
        { name: "s0_c_username", usedBy: [{ service: "web", credential: "username" }] },
        { name: "s0_e1", usedBy: [{ service: "web", env: "MODE" }] }
      ]);
    });

    it("lists no secrets for a definition referencing none", async () => {
      const { service } = setup({ sdl: sdlOf(serviceYaml("web", { env: ["PORT=8080"], credentials: { password: "hunter2" } })) });

      expect(await service.listByUserIdAndDseq(faker.string.uuid(), "1234")).toEqual({ secrets: [] });
    });

    it("never returns a plain value standing beside a reference", async () => {
      const { service } = setup({ sdl: sdlOf(serviceYaml("web", { env: ["PLAIN=visible-value", "TOKEN=ac-secret://TOKEN"] })) });

      const result = await service.listByUserIdAndDseq(faker.string.uuid(), "1234");

      expect(JSON.stringify(result)).not.toContain("visible-value");
    });

    it("reads the definition of the wallet the caller may read, under the caller's ability", async () => {
      const { service, wallet, walletReaderService, signerService, deploymentSettingRepository, scopedDeploymentSettingRepository, authService } = setup({
        sdl: sdlOf(serviceYaml("web", { env: ["TOKEN=ac-secret://TOKEN"] }))
      });
      const userId = faker.string.uuid();

      await service.listByUserIdAndDseq(userId, "1234");

      expect(walletReaderService.findReadableWalletByUserId).toHaveBeenCalledWith(userId);
      expect(signerService.isDeploymentInProjectScope).toHaveBeenCalledWith(wallet, "1234", "read");
      expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(authService.ability, "read");
      expect(scopedDeploymentSettingRepository.findOneOfWallet).toHaveBeenCalledWith(wallet, "1234");
    });

    it("answers not found when the caller has no readable wallet", async () => {
      const { service, scopedDeploymentSettingRepository } = setup({ wallet: null, sdl: sdlOf(serviceYaml("web", { env: ["TOKEN=ac-secret://TOKEN"] })) });

      await expect(service.listByUserIdAndDseq(faker.string.uuid(), "1234")).rejects.toMatchObject({ status: 404, message: "Deployment not found" });
      expect(scopedDeploymentSettingRepository.findOneOfWallet).not.toHaveBeenCalled();
    });

    it("answers not found for a deployment outside the request's project scope", async () => {
      const { service, scopedDeploymentSettingRepository } = setup({
        inProjectScope: false,
        sdl: sdlOf(serviceYaml("web", { env: ["TOKEN=ac-secret://TOKEN"] }))
      });

      await expect(service.listByUserIdAndDseq(faker.string.uuid(), "1234")).rejects.toMatchObject({ status: 404, message: "Deployment not found" });
      expect(scopedDeploymentSettingRepository.findOneOfWallet).not.toHaveBeenCalled();
    });

    it("answers not found when the caller can see no setting for the deployment", async () => {
      const { service } = setup({ setting: null });

      await expect(service.listByUserIdAndDseq(faker.string.uuid(), "1234")).rejects.toMatchObject({ status: 404, message: "Deployment not found" });
    });

    it("answers not found when the setting records no sdl", async () => {
      const { service } = setup({ sdl: null });

      await expect(service.listByUserIdAndDseq(faker.string.uuid(), "1234")).rejects.toMatchObject({ status: 404, message: "Deployment not found" });
    });

    it("answers not found when the setting records an sdl but no manifest version, as reading the definition does", async () => {
      const { service } = setup({ sdl: sdlOf(serviceYaml("web", { env: ["TOKEN=ac-secret://TOKEN"] })), manifestVersion: null });

      await expect(service.listByUserIdAndDseq(faker.string.uuid(), "1234")).rejects.toMatchObject({ status: 404, message: "Deployment not found" });
    });

    it("answers a permanent server error without quoting the document when the stored sdl does not parse", async () => {
      const { service, logger } = setup({ sdl: "services: [unclosed" });
      const userId = faker.string.uuid();

      const error = await service.listByUserIdAndDseq(userId, "1234").catch(caught => caught);

      expect(error).toMatchObject({ status: 500, errorCode: "stored_sdl_unreadable", message: "The SDL recorded for this deployment cannot be read" });
      expect(error.cause).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith({ event: "DEPLOYMENT_STORED_SDL_UNPARSEABLE", userId, dseq: "1234" });
    });
  });

  it("names its logger after itself", () => {
    const { createLogger } = setup({ sdl: null });

    expect(createLogger).toHaveBeenCalledWith({ context: DeploymentSecretsReaderService.name });
  });

  function serviceYaml(name: string, input: { env?: string[]; credentials?: Record<string, string> }) {
    const env = input.env ? `    env:\n${input.env.map(entry => `      - ${JSON.stringify(entry)}\n`).join("")}` : "";
    const credentials = input.credentials
      ? `    credentials:\n      host: registry.example.test\n${Object.entries(input.credentials)
          .map(([field, value]) => `      ${field}: ${JSON.stringify(value)}\n`)
          .join("")}`
      : "";

    return `  ${name}:\n    image: nginx\n${env}${credentials}`;
  }

  function sdlOf(...services: string[]) {
    return `version: "2.0"\nservices:\n${services.join("")}`;
  }

  function setup(input: { sdl?: string | null; manifestVersion?: string | null; setting?: null; wallet?: null; inProjectScope?: boolean }) {
    const wallet: UserWalletOutput | null = input.wallet === null ? null : createOrganizationWallet();
    const setting =
      input.setting === null
        ? undefined
        : mock<DeploymentSettingsOutput>({ sdl: input.sdl ?? null, manifestVersion: input.manifestVersion === undefined ? "BAUG" : input.manifestVersion });
    const walletReaderService = mock<WalletReaderService>({ findReadableWalletByUserId: vi.fn().mockResolvedValue(wallet ?? undefined) });
    const signerService = mock<ManagedSignerService>({ isDeploymentInProjectScope: vi.fn().mockResolvedValue(input.inProjectScope ?? true) });
    const scopedDeploymentSettingRepository = mock<DeploymentSettingRepository>({ findOneOfWallet: vi.fn().mockResolvedValue(setting) });
    const deploymentSettingRepository = mock<DeploymentSettingRepository>({ accessibleBy: vi.fn().mockReturnValue(scopedDeploymentSettingRepository) });
    const authService = mock<AuthService>({ ability: mock<AuthService["ability"]>() });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new DeploymentSecretsReaderService(
      walletReaderService,
      signerService,
      deploymentSettingRepository,
      authService,
      new SdlReferenceService(),
      createLogger
    );

    return {
      service,
      wallet,
      walletReaderService,
      signerService,
      deploymentSettingRepository,
      scopedDeploymentSettingRepository,
      authService,
      logger,
      createLogger
    };
  }
});
