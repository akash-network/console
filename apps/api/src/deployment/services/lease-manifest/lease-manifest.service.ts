import { manifestToSortedJSON } from "@akashnetwork/chain-sdk";
import { Trace } from "@akashnetwork/instrumentation";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { DeploymentSettingRepository } from "@src/deployment/repositories/deployment-setting/deployment-setting.repository";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlSecretsService } from "@src/deployment/services/sdl-secrets/sdl-secrets.service";

/** Everything a stored definition has to say for the manifest it stands for to be derived again. */
type StoredDefinition = { sdl: string; sealedSecrets: string | null };

/** Why a deployment has no manifest of its own, which is what the residual volume of client-supplied ones is measured by. */
type StoredDefinitionMiss = "nothing-recorded" | "unresolvable";

/** Deliberately names no part of the definition, because the error handler echoes `message` for every `http-errors` instance regardless of `expose`. */
const UNDERIVABLE_ERROR_MESSAGE = "Unable to derive the deployment manifest";

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

    const secrets = definition.sealedSecrets ? await this.sdlSecretsService.openStored({ userId, dseq, sealedSecrets: definition.sealedSecrets }) : {};

    const resolved = await this.sdlService.generateResolvedManifest({ sdl: definition.sdl, secrets });

    if (!resolved.ok) {
      return this.#refuseOrFallBack(definition, { userId, dseq });
    }

    this.#loggerService.info({ event: "LEASE_MANIFEST_DERIVED", userId, dseq, resolvedSecretCount: Object.keys(secrets).length });

    return manifestToSortedJSON(resolved.value.manifest.groups);
  }

  /** Scoped twice over, by the query and by the caller's own ability, so a later refactor has to defeat both to derive one user's manifest for another. */
  async #findDefinition(key: { userId: string; dseq: string }): Promise<StoredDefinition | null> {
    const setting = await this.deploymentSettingRepository.accessibleBy(this.authService.ability, "read").findOneBy(key);

    return setting?.sdl ? { sdl: setting.sdl, sealedSecrets: setting.sealedSecrets } : null;
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

  #refuse(key: { userId: string; dseq: string }) {
    this.#loggerService.error({ event: "LEASE_MANIFEST_UNRESOLVABLE", ...key });

    return createError(500, UNDERIVABLE_ERROR_MESSAGE);
  }
}
