import createError, { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { SECRET_UNREADABLE_ERROR_CODE } from "@src/secret/config/secret-at-rest.config";

/** Says nothing about whether the deployment exists, so a caller cannot learn another user's dseqs by asking to inherit from them. */
const SOURCE_NOT_FOUND_MESSAGE = "No deployment was found to inherit secrets from";

/** The remedy is to supply the values instead, which is the same whichever of the permanent causes it was, so they share one message. */
const SOURCE_UNREADABLE_MESSAGE = "The secrets recorded for the deployment being inherited from can no longer be decrypted";

/** Distinct from the stored-state codes a patch answers with, because this one names the deployment the request pointed at rather than the one it addresses. */
const SOURCE_UNREADABLE_ERROR_CODE = "inherited_secrets_unreadable";

/** The only answer that means the source's secrets are gone for good: a 503 says the key service is merely unreachable, and anything else never came from the cipher at all. */
function isPermanentlyUnreadable(error: unknown): boolean {
  return isHttpError(error) && error.status === 500;
}

/** A permanent failure to decrypt is distinguished from one to read our own stored state, because only the first says the token itself is beyond this data key. */
function isTokenUnreadable(error: unknown): boolean {
  return isHttpError(error) && error.errorCode === SECRET_UNREADABLE_ERROR_CODE;
}

/**
 * Opens the token another deployment of the same user holds, so a redeploy can carry its values forward.
 * Reads nothing but the token: the source's SDL is never consulted, and its `closed` state is deliberately
 * ignored, because secrets are kept when a deployment is closed and redeploying a reclaimed one is the case
 * this serves.
 */
@singleton()
export class SdlSecretsInheritanceService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly sdlSecretsService: SdlSecretsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SdlSecretsInheritanceService.name });
  }

  /** Read through the caller's own ability as well as their id, so another user's deployment is unreachable rather than merely refused. */
  async open(key: { userId: string; dseq: string }): Promise<SdlSecrets> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(key);

    if (!setting) {
      this.#loggerService.warn({ event: "SDL_SECRETS_INHERIT_SOURCE_NOT_FOUND", ...key });

      throw createError(404, SOURCE_NOT_FOUND_MESSAGE);
    }

    if (!setting.sealedSecrets) {
      this.#loggerService.info({ event: "SDL_SECRETS_INHERIT_SOURCE_HAS_NO_SECRETS", ...key });

      return {};
    }

    const inherited = await this.#openStored(setting.sealedSecrets, key);

    this.#loggerService.info({ event: "SDL_SECRETS_INHERITED", ...key, inheritedCount: Object.keys(inherited).length });

    return inherited;
  }

  /** Only the cipher's own permanent answer is rewritten: a 503 stays retryable, and a failure from anywhere else must not masquerade as secrets that are gone. */
  async #openStored(sealedSecrets: string, key: { userId: string; dseq: string }): Promise<SdlSecrets> {
    try {
      return await this.sdlSecretsService.openStored({ ...key, sealedSecrets });
    } catch (error) {
      if (!isPermanentlyUnreadable(error)) throw error;

      throw this.#rejectUnreadable(error, key);
    }
  }

  /** Carries the cause into both the log and the error, because the message a caller receives says only that the secrets will not open and never why. */
  #rejectUnreadable(error: unknown, key: { userId: string; dseq: string }) {
    const event = isTokenUnreadable(error) ? "SDL_SECRETS_INHERIT_TOKEN_UNREADABLE" : "SDL_SECRETS_INHERIT_STATE_UNREADABLE";
    this.#loggerService.error({ event, ...key, error });

    return createError(409, SOURCE_UNREADABLE_MESSAGE, { errorCode: SOURCE_UNREADABLE_ERROR_CODE, cause: error });
  }
}
