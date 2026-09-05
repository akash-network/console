import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import createError, { isHttpError } from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";

type StoredDefinition = { sdl: string; sealedSecrets: string | null };

/** Why a deployment has no manifest of its own, which is what the residual volume of client-supplied ones is measured by. */
type StoredDefinitionMiss = "nothing-recorded" | "unresolvable";

/** Deliberately names no part of the definition, because the error handler echoes `message` for every `http-errors` instance regardless of `expose`. */
const UNDERIVABLE_ERROR_MESSAGE = "Unable to derive the deployment manifest";

/** A definition nothing can re-derive answers 500 for good; only the key service answers 503, and only while it is out of reach. */
function isRetryable(error: unknown): boolean {
  return isHttpError(error) && error.status === 503;
}

/** The manifest a lease sends its provider: what the console stored for the deployment, resolved and re-derived, rather than what the client asked for. */
@singleton()
export class LeaseManifestService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly deploymentSettingRepository: DeploymentSettingRepository,
    private readonly authService: AuthService,
    private readonly sdlSecretsService: SdlSecretsService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly sdlService: SdlService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: LeaseManifestService.name });
  }

  /** Re-derives without trial limits, which gate a create rather than shape a manifest, so no lease is refused by a rule the create it belongs to already cleared. */
  @Trace()
  async deriveFor({ dseq }: { dseq: string }): Promise<string | null> {
    const userId = this.authService.currentUser.id;
    const definition = await this.#findDefinition({ userId, dseq });

    if (!definition) {
      return this.#fallBack({ userId, dseq, reason: "nothing-recorded" });
    }

    const secrets = definition.sealedSecrets ? await this.#openStored(definition.sealedSecrets, { userId, dseq }) : {};

    const resolved = await this.sdlService.generateResolvedManifest({ sdl: definition.sdl, secrets });

    if (!resolved.ok) {
      return this.#refuseOrFallBack(definition, { userId, dseq });
    }

    this.#loggerService.info({ event: "LEASE_MANIFEST_DERIVED", userId, dseq, resolvedSecretCount: Object.keys(secrets).length });

    return manifestToSortedJSON(resolved.value.manifest.groups);
  }

  /** A token beside no sdl is refused rather than fallen back on, so that safety property lives here instead of resting on the one writer that happens to fill both columns in a single statement. */
  async #findDefinition(key: { userId: string; dseq: string }): Promise<StoredDefinition | null> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(key);

    if (setting?.sdl) return { sdl: setting.sdl, sealedSecrets: setting.sealedSecrets };

    if (setting?.sealedSecrets) throw this.#refuse(key);

    return null;
  }

  /** A definition carrying a reference is never eligible for the fallback, because accepting a client's manifest for it would mean accepting a client-supplied secret value. */
  #refuseOrFallBack(definition: StoredDefinition, key: { userId: string; dseq: string }): null {
    if (definition.sealedSecrets !== null || this.#carriesReference(definition.sdl)) {
      throw this.#refuse(key);
    }

    return this.#fallBack({ ...key, reason: "unresolvable" });
  }

  /** An SDL that will not parse cannot be shown to carry no reference, and only a definition shown to carry none may fall back. */
  #carriesReference(sdl: string): boolean {
    const document = this.sdlService.parse(sdl);

    return !document.ok || this.sdlReferenceService.hasAnyReference(document.value);
  }

  #fallBack({ reason, ...key }: { userId: string; dseq: string; reason: StoredDefinitionMiss }): null {
    this.#loggerService.info({ event: "LEASE_MANIFEST_FALLBACK", ...key, reason });

    return null;
  }

  /** Keeps the cause's own error, so a key service that is merely unreachable still answers 503 rather than reading as a definition that cannot be derived. */
  async #openStored(sealedSecrets: string, key: { userId: string; dseq: string }) {
    try {
      return await this.sdlSecretsService.openStored({ ...key, sealedSecrets });
    } catch (error) {
      throw isRetryable(error) ? this.#reportUnreachable(key, error) : this.#refuse(key, error);
    }
  }

  /** A separate event from a refusal, because a blip that will succeed on retry must not count against the definitions that can never be re-derived. */
  #reportUnreachable(key: { userId: string; dseq: string }, cause: unknown) {
    this.#loggerService.warn({ event: "LEASE_MANIFEST_UNREACHABLE", ...key });

    return cause;
  }

  #refuse(key: { userId: string; dseq: string }, cause?: unknown) {
    this.#loggerService.error({ event: "LEASE_MANIFEST_UNRESOLVABLE", ...key });

    return cause ?? createError(500, UNDERIVABLE_ERROR_MESSAGE);
  }
}
