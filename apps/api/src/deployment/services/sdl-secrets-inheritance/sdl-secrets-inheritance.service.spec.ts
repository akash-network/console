import type { Ability } from "@casl/ability";
import { faker } from "@faker-js/faker";
import createError from "http-errors";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { DeploymentSettingsOutput } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import type { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { SECRET_UNREADABLE_ERROR_CODE, SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import { SdlSecretsInheritanceService } from "./sdl-secrets-inheritance.service";

const SOURCE = { userId: "user-1", dseq: "1420000000001" };
const TOKEN = "stored.token.aaa.bbb.ccc";

describe(SdlSecretsInheritanceService.name, () => {
  it("returns the values the source deployment's token opens to", async () => {
    const carried = { TOKEN: faker.string.alphanumeric(32) };
    const { service } = setup({ opened: carried });

    await expect(service.open(SOURCE)).resolves.toEqual(carried);
  });

  it("opens the token the source row holds, under the source's own key", async () => {
    const { service, sdlSecretsService } = setup();

    await service.open(SOURCE);

    expect(sdlSecretsService.openStored).toHaveBeenCalledWith({ ...SOURCE, sealedSecrets: TOKEN });
  });

  it("reads the source through the caller's own ability as well as their id", async () => {
    const { service, deploymentSettingRepository, scoped, ability } = setup();

    await service.open(SOURCE);

    expect(deploymentSettingRepository.accessibleBy).toHaveBeenCalledWith(ability, "read");
    expect(scoped.findOneBy).toHaveBeenCalledWith(SOURCE);
  });

  it("inherits from a closed deployment, because closing a deployment keeps its secrets", async () => {
    const carried = { TOKEN: faker.string.alphanumeric(32) };
    const { service } = setup({ setting: mock<DeploymentSettingsOutput>({ sealedSecrets: TOKEN, closed: true }), opened: carried });

    await expect(service.open(SOURCE)).resolves.toEqual(carried);
  });

  it("inherits from a deployment the console recorded no sdl for, needing only its token", async () => {
    const carried = { TOKEN: faker.string.alphanumeric(32) };
    const { service } = setup({ setting: mock<DeploymentSettingsOutput>({ sealedSecrets: TOKEN, sdl: null }), opened: carried });

    await expect(service.open(SOURCE)).resolves.toEqual(carried);
  });

  describe("a source the caller cannot reach", () => {
    it("answers not found", async () => {
      const { service } = setup({ setting: undefined });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ status: 404 });
    });

    it("says nothing about whether the deployment exists", async () => {
      const { service } = setup({ setting: undefined });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ message: "No deployment was found to inherit secrets from" });
    });

    it("spends no key-service call on it", async () => {
      const { service, sdlSecretsService } = setup({ setting: undefined });

      await expect(service.open(SOURCE)).rejects.toThrow();
      expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
    });
  });

  describe("a source holding no token", () => {
    it("inherits nothing rather than refusing, so an unanswered reference is reported by name instead", async () => {
      const { service } = setup({ setting: mock<DeploymentSettingsOutput>({ sealedSecrets: null }) });

      await expect(service.open(SOURCE)).resolves.toEqual({});
    });

    it("does not reach the key service", async () => {
      const { service, sdlSecretsService } = setup({ setting: mock<DeploymentSettingsOutput>({ sealedSecrets: null }) });

      await service.open(SOURCE);

      expect(sdlSecretsService.openStored).not.toHaveBeenCalled();
    });

    it("records that it found nothing, so a silent no-op is distinguishable from a working inherit", async () => {
      const { service, logger } = setup({ setting: mock<DeploymentSettingsOutput>({ sealedSecrets: null }) });

      await service.open(SOURCE);

      expect(logger.info).toHaveBeenCalledWith({ event: "SDL_SECRETS_INHERIT_SOURCE_HAS_NO_SECRETS", ...SOURCE });
    });
  });

  describe("a token this data key can no longer open", () => {
    it("answers conflict rather than the server error the cipher raised", async () => {
      const { service } = setup({ openStoredError: unreadableTokenError() });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ status: 409 });
    });

    it("carries a code that tells the failure apart from stored state of the deployment being created", async () => {
      const { service } = setup({ openStoredError: unreadableTokenError() });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ errorCode: "inherited_secrets_unreadable" });
    });

    it("explains that the secrets can no longer be decrypted", async () => {
      const { service } = setup({ openStoredError: unreadableTokenError() });

      await expect(service.open(SOURCE)).rejects.toMatchObject({
        message: "The secrets recorded for the deployment being inherited from can no longer be decrypted"
      });
    });

    it("records it as a token beyond this data key, with the cause it was given", async () => {
      const cause = unreadableTokenError();
      const { service, logger } = setup({ openStoredError: cause });

      await expect(service.open(SOURCE)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith({ event: "SDL_SECRETS_INHERIT_TOKEN_UNREADABLE", ...SOURCE, error: cause });
    });

    it("carries the cause on the error it raises, so a refusal can be diagnosed after the fact", async () => {
      const cause = unreadableTokenError();
      const { service } = setup({ openStoredError: cause });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ cause });
    });
  });

  describe("stored state the console itself cannot read", () => {
    it("answers the same conflict, the caller's remedy being the same", async () => {
      const { service } = setup({ openStoredError: createError(500, SECRET_UNREADABLE_ERROR_MESSAGE) });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ status: 409, errorCode: "inherited_secrets_unreadable" });
    });

    it("records it under its own event, so it can be told apart from a token beyond the data key", async () => {
      const cause = createError(500, SECRET_UNREADABLE_ERROR_MESSAGE);
      const { service, logger } = setup({ openStoredError: cause });

      await expect(service.open(SOURCE)).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith({ event: "SDL_SECRETS_INHERIT_STATE_UNREADABLE", ...SOURCE, error: cause });
    });
  });

  describe("a key service that is merely unreachable", () => {
    it("keeps the transient failure rather than reporting secrets that are gone", async () => {
      const { service } = setup({ openStoredError: createError(503, "Service temporarily unavailable") });

      await expect(service.open(SOURCE)).rejects.toMatchObject({ status: 503 });
    });

    it("attaches no permanent code to it", async () => {
      const { service } = setup({ openStoredError: createError(503, "Service temporarily unavailable") });

      await expect(service.open(SOURCE)).rejects.toSatisfy((error: { errorCode?: string }) => error.errorCode === undefined);
    });
  });

  describe("a failure that never came from the cipher", () => {
    it("raises it unchanged rather than reporting secrets that are gone", async () => {
      const cause = new Error("connection terminated unexpectedly");
      const { service } = setup({ openStoredError: cause });

      await expect(service.open(SOURCE)).rejects.toBe(cause);
    });

    it("attaches no permanent code to it, so a pool blip is not read as undecryptable secrets", async () => {
      const { service } = setup({ openStoredError: new Error("connection terminated unexpectedly") });

      await expect(service.open(SOURCE)).rejects.toSatisfy((error: { errorCode?: string; status?: number }) => !error.errorCode && !error.status);
    });
  });

  it("logs how many values it inherited and none of them", async () => {
    const value = faker.string.alphanumeric(32);
    const { service, logger } = setup({ opened: { TOKEN: value } });

    await service.open(SOURCE);

    expect(logger.info).toHaveBeenCalledWith({ event: "SDL_SECRETS_INHERITED", ...SOURCE, inheritedCount: 1 });
  });

  it("never logs an inherited value", async () => {
    const value = faker.string.alphanumeric(32);
    const { service, logger } = setup({ opened: { TOKEN: value } });

    await service.open(SOURCE);

    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain(value);
  });

  function unreadableTokenError() {
    return createError(500, SECRET_UNREADABLE_ERROR_MESSAGE, { errorCode: SECRET_UNREADABLE_ERROR_CODE });
  }

  function setup(input?: { setting?: DeploymentSettingsOutput; opened?: SdlSecrets; openStoredError?: Error }) {
    const setting = "setting" in (input ?? {}) ? input!.setting : mock<DeploymentSettingsOutput>({ sealedSecrets: TOKEN });

    const scoped = mock<DeploymentSettingRepository>();
    scoped.findOneBy.mockResolvedValue(setting);
    const deploymentSettingRepository = mock<DeploymentSettingRepository>();
    deploymentSettingRepository.accessibleBy.mockReturnValue(scoped);

    const ability = mock<Ability>();
    const authService = mock<AuthService>({ ability });

    const sdlSecretsService = mock<SdlSecretsService>();
    if (input?.openStoredError) sdlSecretsService.openStored.mockRejectedValue(input.openStoredError);
    else sdlSecretsService.openStored.mockResolvedValue(input?.opened ?? {});

    const logger = mock<ReturnType<CreateLogger>>();
    const service = new SdlSecretsInheritanceService(deploymentSettingRepository, authService, sdlSecretsService, () => logger);

    return { service, deploymentSettingRepository, scoped, ability, sdlSecretsService, logger };
  }
});
