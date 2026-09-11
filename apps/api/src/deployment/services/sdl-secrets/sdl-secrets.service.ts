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

/** Which set broke a limit, because a redeploy that inherits its values supplied none of them and must not be told to supply fewer. */
type SdlSecretsOrigin = "supplied" | "carried" | "stored";

function countExceededMessage(origin: SdlSecretsOrigin, maxCount: number): string {
  const messages: Record<SdlSecretsOrigin, string> = {
    supplied: `At most ${maxCount} secrets may be supplied for one deployment`,
    carried: `At most ${maxCount} secrets may be carried by one deployment, counting those inherited from another`,
    stored: `At most ${maxCount} secrets may be stored for one deployment`
  };

  return messages[origin];
}

/** The two ways a reference can already be answered when a create is received: by this request, or by the deployment it inherits from. */
type ReceivedSdlSecretSets = { supplied: SdlSecrets; inherited: SdlSecrets };

/** Each set is asked separately, so a non-string sitting under a name in one of them cannot shadow a usable value in the other. */
function isCovered(sets: ReceivedSdlSecretSets, name: string): boolean {
  return typeof ownValue(sets.supplied, name) === "string" || typeof ownValue(sets.inherited, name) === "string";
}

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
  async receive(input: { sdl: SDLInput; rawSdl: string; sealedSecrets?: string; inherited?: SdlSecrets }): Promise<ReceiveSdlSecretsResult> {
    const declarations = this.sdlReferenceService.declarationsOf(input.sdl, SECRET_REFERENCE_KIND);
    const inherited = input.inherited ?? NOTHING_SUPPLIED;
    const supplied = input.sealedSecrets ? await this.#openSupplied(input.sealedSecrets, input.rawSdl) : NOTHING_SUPPLIED;

    const errors = this.#mismatchesBetween(declarations, { supplied, inherited });

    if (errors.length > 0) return { ok: false, value: errors };

    if (declarations.length > 0 || Object.keys(supplied).length > 0) {
      this.#loggerService.info({
        event: "SDL_SECRETS_RECEIVED",
        suppliedCount: Object.keys(supplied).length,
        inheritedCount: Object.keys(inherited).length,
        referencedNames: [...new Set(declarations.map(declaration => declaration.name))],
        serviceCount: new Set(declarations.map(declaration => declaration.serviceName)).size
      });
    }

    return { ok: true, value: supplied };
  }

  /** Opening is what costs a key-service call, so it stays behind the check for a seal rather than inside the one pass that reads both sets. */
  async #openSupplied(seal: string, rawSdl: string): Promise<SdlSecrets> {
    const supplied = await this.unsealerService.open({ seal, sdl: rawSdl });
    this.#assertWithinLimits(supplied, "supplied");

    return supplied;
  }

  /** Bounds the whole set a deployment would carry, because measuring one request alone would let a merge grow the stored token past the ceiling one request at a time. */
  assertStorable(secrets: SdlSecrets, origin: Exclude<SdlSecretsOrigin, "supplied">): void {
    this.#assertWithinLimits(secrets, origin);
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
    this.#assertWithinLimits(supplied, "supplied");

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
  #mismatchesBetween(declarations: SdlReferenceDeclaration[], sets: ReceivedSdlSecretSets): ValidationError[] {
    const errors: ValidationError[] = [];
    const referenced = new Set<string>();

    for (const declaration of declarations) {
      if (isCovered(sets, declaration.name)) {
        referenced.add(declaration.name);
        continue;
      }

      errors.push(missingSdlReferenceValueError(declaration));
    }

    for (const name of Object.keys(sets.supplied)) {
      if (!referenced.has(name)) errors.push(unreferencedNameError(name));
    }

    return errors;
  }

  /** Every bound is measured as `jsonEncodedBytes`, matching the seal budget, because a raw-length check would let a payload pass here and die on the body limit. */
  #assertWithinLimits(supplied: SdlSecrets, origin: SdlSecretsOrigin): void {
    const maxCount = this.config.get("SDL_SECRETS_MAX_COUNT");
    const names = Object.keys(supplied);

    if (names.length > maxCount) {
      throw this.#reject("SDL_SECRETS_COUNT_EXCEEDED", countExceededMessage(origin, maxCount), { suppliedCount: names.length, origin });
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
