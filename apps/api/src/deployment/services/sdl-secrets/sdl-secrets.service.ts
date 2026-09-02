import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { jsonEncodedBytes } from "@src/deployment/config/sdl-secrets.config";
import type { NamespacedSdlSecrets, SdlReferenceDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import {
  MAX_ECHOED_REFERENCE_LENGTH,
  MAX_SDL_REFERENCE_NAME_LENGTH,
  missingSdlReferenceValueError,
  ownValue,
  SdlReferenceService
} from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";

/** The kind of SDL Reference a sealed payload answers. Other kinds resolve from elsewhere and are none of this service's business. */
const SECRET_REFERENCE_KIND = "secret";

export interface ReceivedSdlSecrets {
  /** What the client sealed, unchanged, because this is what gets re-sealed for storage: one flat name-to-value map per deployment. */
  supplied: SdlSecrets;
  /** The same values indexed by the service that referenced them, which is the shape resolution reads. */
  byService: NamespacedSdlSecrets;
}

export type ReceiveSdlSecretsResult = { ok: true; value: ReceivedSdlSecrets } | { ok: false; value: ValidationError[] };

const NOTHING_SUPPLIED: ReceivedSdlSecrets = { supplied: {}, byService: {} };

function unreferencedNameError(name: string): ValidationError {
  const echoed = name.slice(0, MAX_ECHOED_REFERENCE_LENGTH);

  return {
    schemaPath: "",
    instancePath: "",
    keyword: "sdl-reference",
    params: { name: echoed },
    message: `a value was supplied for "${echoed}" but no service's SDL references it`
  };
}

/**
 * Turns a transport seal plus an SDL into the values a deployment's references resolve to, refusing
 * anything the two disagree about. Nothing here ever logs, echoes or returns a value: the widest thing
 * it says out loud is a name, and a name is already in the SDL it came from.
 *
 * Names are logged distinctly rather than per reference, which is what bounds the line: an SDL can
 * declare a reference per env entry of per service, but by the time anything is logged every name has a
 * supplied value, so the distinct set is bounded by the supplied-count limit.
 */
@singleton()
export class SdlSecretsService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly unsealerService: SdlSecretsUnsealerService,
    private readonly sdlReferenceService: SdlReferenceService,
    private readonly secretCipherService: SecretCipherService,
    private readonly config: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SdlSecretsService.name });
  }

  /**
   * Opens the seal, then checks the SDL against it in both directions: a reference with no value and a
   * value no service references are both mistakes, and reporting only the first would let a typo on the
   * supplying side ship silently.
   *
   * Runs on every create rather than only when a seal arrives, so a reference with no value is refused
   * at one point whether or not the request carried anything. Callers pass the parsed document, because
   * an SDL that does not parse has already been refused by the manifest generator and this must not
   * become a second place that reports it.
   */
  async receive(input: { sdl: SDLInput; rawSdl: string; sealedSecrets?: string }): Promise<ReceiveSdlSecretsResult> {
    const declarations = this.sdlReferenceService.declarationsOf(input.sdl, SECRET_REFERENCE_KIND);

    if (!input.sealedSecrets) {
      return declarations.length === 0 ? { ok: true, value: NOTHING_SUPPLIED } : { ok: false, value: declarations.map(missingSdlReferenceValueError) };
    }

    const supplied = await this.unsealerService.open({ seal: input.sealedSecrets, sdl: input.rawSdl });
    this.#assertWithinLimits(supplied);

    const { byService, errors } = this.#assignToServices(declarations, supplied);

    if (errors.length > 0) return { ok: false, value: errors };

    this.#loggerService.info({
      event: "SDL_SECRETS_RECEIVED",
      suppliedCount: Object.keys(supplied).length,
      referencedNames: [...new Set(declarations.map(declaration => declaration.name))],
      serviceCount: Object.keys(byService).length
    });

    return { ok: true, value: { supplied, byService } };
  }

  /**
   * Re-seals for storage under the owner's own data encryption key, bound to the deployment the values
   * were supplied for. The console stores this rather than what the client sent, because a client seals
   * before the deployment exists and cannot name a dseq that has not been minted yet.
   *
   * Costs no key-service call of its own: the data key is already in hand for the request, and the
   * at-rest form encrypts directly under it.
   *
   * Returns null for a deployment that supplied nothing, so a create always has a value to write and a
   * retry cannot inherit the token an abandoned attempt left on the same row.
   */
  async sealForStorage(input: { userId: string; dseq: string; secrets: SdlSecrets }): Promise<string | null> {
    const names = Object.keys(input.secrets);

    if (names.length === 0) return null;

    const sealed = await this.secretCipherService.encrypt(input.userId, JSON.stringify(input.secrets), { sub: input.userId, dseq: input.dseq });

    this.#loggerService.info({ event: "SDL_SECRETS_SEALED", userId: input.userId, dseq: input.dseq, secretCount: names.length });

    return sealed;
  }

  /**
   * One value per reference, so a name several services refer to reaches each of them and a name none
   * refer to reaches nothing. Namespaces are built from the walk rather than by giving every service a
   * copy of everything, so a service that references nothing is handed nothing.
   */
  #assignToServices(declarations: SdlReferenceDeclaration[], supplied: SdlSecrets) {
    const byService: NamespacedSdlSecrets = Object.create(null);
    const errors: ValidationError[] = [];
    const referenced = new Set<string>();

    for (const declaration of declarations) {
      const value = ownValue(supplied, declaration.name);

      if (typeof value !== "string") {
        errors.push(missingSdlReferenceValueError(declaration));
        continue;
      }

      const namespace = (byService[declaration.serviceName] ??= Object.create(null) as SdlSecrets);
      namespace[declaration.name] = value;
      referenced.add(declaration.name);
    }

    for (const name of Object.keys(supplied)) {
      if (!referenced.has(name)) errors.push(unreferencedNameError(name));
    }

    return { byService, errors };
  }

  /**
   * Refuses on shape before anything is minted or written, and names the limit rather than what breached
   * it. Every bound here is measured as `jsonEncodedBytes`, the same way the seal budget is computed,
   * because the plaintext these values end up in is a JSON object and escaping is not size-preserving.
   * A raw-length check would let a payload pass these and then die on the body limit with a bare 413.
   */
  #assertWithinLimits(supplied: SdlSecrets): void {
    const maxCount = this.config.get("SDL_SECRETS_MAX_COUNT");
    const names = Object.keys(supplied);

    if (names.length > maxCount) {
      throw this.#reject("SDL_SECRETS_COUNT_EXCEEDED", `At most ${maxCount} secrets may be supplied for one deployment`, { suppliedCount: names.length });
    }

    const maxValueBytes = this.config.get("SDL_SECRETS_MAX_VALUE_BYTES");

    for (const name of names) {
      const echoed = name.slice(0, MAX_ECHOED_REFERENCE_LENGTH);
      const nameBytes = jsonEncodedBytes(name);

      if (nameBytes > MAX_SDL_REFERENCE_NAME_LENGTH) {
        throw this.#reject("SDL_SECRETS_NAME_TOO_LONG", `Secret name "${echoed}" exceeds the maximum of ${MAX_SDL_REFERENCE_NAME_LENGTH} bytes`, {
          name: echoed,
          nameBytes
        });
      }

      const valueBytes = jsonEncodedBytes(supplied[name]);

      if (valueBytes > maxValueBytes) {
        throw this.#reject("SDL_SECRETS_VALUE_TOO_LARGE", `Secret "${echoed}" exceeds the maximum value size of ${maxValueBytes} bytes once JSON-encoded`, {
          name: echoed,
          valueBytes
        });
      }
    }
  }

  #reject(event: string, message: string, details: Record<string, unknown>) {
    this.#loggerService.warn({ event, ...details });

    return createError(400, message);
  }
}
