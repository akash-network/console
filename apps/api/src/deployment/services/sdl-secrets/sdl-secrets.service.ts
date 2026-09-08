import type { SDLInput, ValidationError } from "@akashnetwork/chain-sdk";
import createError, { isHttpError } from "http-errors";
import { decodeProtectedHeader } from "jose";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core";
import { jsonEncodedBytes } from "@src/deployment/config/sdl-secrets.config";
import type { SdlReferenceDeclaration } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import {
  MAX_ECHOED_REFERENCE_LENGTH,
  MAX_SDL_REFERENCE_NAME_LENGTH,
  missingSdlReferenceValueError,
  ownValue,
  SdlReferenceService
} from "@src/deployment/services/sdl-reference/sdl-reference.service";
import type { SdlSecrets } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { parseSdlSecrets, SdlSecretsUnsealerService } from "@src/deployment/services/sdl-secrets-unsealer/sdl-secrets-unsealer.service";
import { SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import { SecretCipherService } from "@src/secret/services/secret-cipher/secret-cipher.service";
import { DeploymentConfigService } from "../deployment-config/deployment-config.service";

/** The kind of SDL Reference a sealed payload answers. Other kinds resolve from elsewhere and are none of this service's business. */
const SECRET_REFERENCE_KIND = "secret";

/** What the client sealed, unchanged: the one flat name-to-value map a deployment has, which is both what resolution reads and what gets re-sealed for storage. */
export type ReceiveSdlSecretsResult = { ok: true; value: SdlSecrets } | { ok: false; value: ValidationError[] };

const NOTHING_SUPPLIED: SdlSecrets = {};

/** An unreachable key service answers 503 and will succeed on retry, so it is not evidence that anything moved the stored data. */
function isRetryable(error: unknown): boolean {
  return isHttpError(error) && error.status === 503;
}

/** Reads the protected header without a key, so a token that cannot be decrypted can still say which data key and deployment it claims to belong to. */
function claimsOf(sealedSecrets: string): Record<string, unknown> | undefined {
  try {
    return decodeProtectedHeader(sealedSecrets) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

export function unreferencedNameError(name: string): ValidationError {
  const echoed = name.slice(0, MAX_ECHOED_REFERENCE_LENGTH);

  return {
    schemaPath: "",
    instancePath: "",
    keyword: "sdl-reference",
    params: { name: echoed },
    message: `a value was supplied for "${echoed}" but no service's SDL references it`
  };
}

/** Nothing here may log, echo or return a secret value: the widest thing it says out loud is a name, which is already in the SDL it came from. */
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

  /** Takes the parsed document, because an SDL that does not parse has already been refused by the manifest generator and this must not report it twice. */
  async receive(input: { sdl: SDLInput; rawSdl: string; sealedSecrets?: string }): Promise<ReceiveSdlSecretsResult> {
    const declarations = this.sdlReferenceService.declarationsOf(input.sdl, SECRET_REFERENCE_KIND);

    if (!input.sealedSecrets) {
      return declarations.length === 0 ? { ok: true, value: NOTHING_SUPPLIED } : { ok: false, value: declarations.map(missingSdlReferenceValueError) };
    }

    const supplied = await this.unsealerService.open({ seal: input.sealedSecrets, sdl: input.rawSdl });
    this.#assertWithinLimits(supplied);

    const errors = this.#mismatchesBetween(declarations, supplied);

    if (errors.length > 0) return { ok: false, value: errors };

    this.#loggerService.info({
      event: "SDL_SECRETS_RECEIVED",
      suppliedCount: Object.keys(supplied).length,
      referencedNames: [...new Set(declarations.map(declaration => declaration.name))],
      serviceCount: new Set(declarations.map(declaration => declaration.serviceName)).size
    });

    return { ok: true, value: supplied };
  }

  /** Bounds the whole set a deployment would carry, because measuring one request alone would let a merge grow the stored token past the ceiling one request at a time. */
  assertStorable(secrets: SdlSecrets): void {
    this.#assertWithinLimits(secrets);
  }

  /** Returns null when nothing was supplied, so a create always has a value to write and a retry cannot inherit an abandoned attempt's token. */
  async sealForStorage(input: { userId: string; dseq: string; secrets: SdlSecrets }): Promise<string | null> {
    const names = Object.keys(input.secrets);

    if (names.length === 0) return null;

    const sealed = await this.secretCipherService.encrypt(input.userId, JSON.stringify(input.secrets), { sub: input.userId, dseq: input.dseq });

    this.#loggerService.info({ event: "SDL_SECRETS_SEALED", userId: input.userId, dseq: input.dseq, secretCount: names.length });

    return sealed;
  }

  /** Opens a client's seal without holding it to what the SDL declares, because a patch supplies only what changed and the rest resolves from what is stored. */
  async receiveForMerge(input: { rawSdl: string; sealedSecrets: string }): Promise<SdlSecrets> {
    const supplied = await this.unsealerService.open({ seal: input.sealedSecrets, sdl: input.rawSdl });
    this.#assertWithinLimits(supplied);

    this.#loggerService.info({ event: "SDL_SECRETS_RECEIVED_FOR_MERGE", suppliedCount: Object.keys(supplied).length });

    return supplied;
  }

  /** Opens what `sealForStorage` wrote under the same binding, so a token moved to another deployment's row or another user's fails to open rather than resolving into it. */
  async openStored(input: { userId: string; dseq: string; sealedSecrets: string }): Promise<SdlSecrets> {
    const opened = await this.#decryptStored(input);
    const secrets = parseSdlSecrets(opened);

    if (!secrets) {
      this.#loggerService.error({ event: "SDL_SECRETS_STORED_PAYLOAD_INVALID", userId: input.userId, dseq: input.dseq });

      throw createError(500, SECRET_UNREADABLE_ERROR_MESSAGE);
    }

    this.#loggerService.info({ event: "SDL_SECRETS_STORED_OPENED", userId: input.userId, dseq: input.dseq, secretCount: Object.keys(secrets).length });

    return secrets;
  }

  /** Records only a permanent failure, and only the header's claims, which name the data key, the user and the deployment and carry none of the ciphertext. */
  async #decryptStored(input: { userId: string; dseq: string; sealedSecrets: string }): Promise<string> {
    try {
      return await this.secretCipherService.decrypt(input.userId, input.sealedSecrets, { sub: input.userId, dseq: input.dseq });
    } catch (error) {
      if (!isRetryable(error)) {
        this.#loggerService.error({
          event: "SECRET_DECRYPT_FAILED",
          userId: input.userId,
          dseq: input.dseq,
          claims: claimsOf(input.sealedSecrets)
        });
      }

      throw error;
    }
  }

  /** Both directions are reported from one pass, so a request that gets each side wrong hears about both at once. */
  #mismatchesBetween(declarations: SdlReferenceDeclaration[], supplied: SdlSecrets): ValidationError[] {
    const errors: ValidationError[] = [];
    const referenced = new Set<string>();

    for (const declaration of declarations) {
      if (typeof ownValue(supplied, declaration.name) === "string") {
        referenced.add(declaration.name);
        continue;
      }

      errors.push(missingSdlReferenceValueError(declaration));
    }

    for (const name of Object.keys(supplied)) {
      if (!referenced.has(name)) errors.push(unreferencedNameError(name));
    }

    return errors;
  }

  /** Every bound is measured as `jsonEncodedBytes`, matching the seal budget, because a raw-length check would let a payload pass here and die on the body limit. */
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
