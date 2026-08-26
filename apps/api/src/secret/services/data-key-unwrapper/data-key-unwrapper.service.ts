import createError from "http-errors";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { HeldDataKey } from "@src/core/services/execution-context/execution-context.service";
import { ExecutionContextService } from "@src/core/services/execution-context/execution-context.service";
import { SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsTarget } from "@src/deployment/providers/kms.provider";
import { SDL_SECRETS_KMS_TARGET } from "@src/deployment/providers/kms.provider";
import type { KmsWrappedJweFailure, ParsedKmsWrappedJwe } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { KmsWrappedJweError, KmsWrappedJweService } from "@src/deployment/services/kms-wrapped-jwe/kms-wrapped-jwe.service";
import { SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import type { DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";

/** AES-256 content encryption, so the data encryption key is 256 bits. */
const DATA_ENCRYPTION_KEY_BYTES = 32;

/** Retrying reaches a key service that has recovered; every other failure means the stored row itself is unusable. */
const KEY_SERVICE_FAILURES: ReadonlySet<KmsWrappedJweFailure> = new Set([
  "KEY_SERVICE_UNREACHABLE",
  "KEY_SERVICE_REQUEST_CORRUPTED",
  "KEY_SERVICE_PLAINTEXT_MISSING",
  "KEY_SERVICE_RESPONSE_CORRUPTED"
]);

/** Never holds an unwrapped key on this instance, because a resolution-scoped field would be pinned for the process lifetime by the first singleton to inject it. */
@singleton()
export class DataKeyUnwrapperService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyService: DataKeyService,
    private readonly executionContextService: ExecutionContextService,
    private readonly wrappedJweService: KmsWrappedJweService,
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: DataKeyUnwrapperService.name });
  }

  async getDataKey(userId: string): Promise<HeldDataKey> {
    const heldThisRequest = this.#heldDataKeys(userId);
    const held = heldThisRequest.get(userId);

    if (held) return await held;

    const holding = this.#holdDataKey(userId, heldThisRequest).catch(error => {
      heldThisRequest.delete(userId);

      throw error;
    });

    heldThisRequest.set(userId, holding);

    return await holding;
  }

  #heldDataKeys(userId: string) {
    if (!this.executionContextService.hasContext()) {
      throw this.#rejectUnreadable("USER_DATA_KEY_OUTSIDE_REQUEST", { userId });
    }

    const held = this.#currentlyHeldDataKeys();

    if (held) return held;

    const heldThisRequest = new Map<string, Promise<HeldDataKey>>();
    this.executionContextService.set("HELD_DATA_KEYS", heldThisRequest);

    return heldThisRequest;
  }

  #currentlyHeldDataKeys() {
    return this.executionContextService.hasContext() ? this.executionContextService.get("HELD_DATA_KEYS") : undefined;
  }

  /** Neither a failed nor a refused unwrap is remembered: the first lets a recovered key service serve the next value, the second drops the only reference this process holds to the plaintext key. */
  async #holdDataKey(userId: string, heldThisRequest: Map<string, Promise<HeldDataKey>>): Promise<HeldDataKey> {
    const dataKey = await this.dataKeyService.ensureDataKey(userId);
    let unwrapping: Promise<Buffer> | undefined;

    const unwrap = async () => {
      if (this.#currentlyHeldDataKeys() !== heldThisRequest) {
        unwrapping = undefined;

        throw this.#rejectUnreadable("USER_DATA_KEY_ESCAPED_REQUEST", { userId, dataKeyId: dataKey.id });
      }

      if (!unwrapping) {
        unwrapping = this.#unwrapDataKey(dataKey, userId).catch(error => {
          unwrapping = undefined;

          throw error;
        });
      }

      return await unwrapping;
    };

    return { id: dataKey.id, unwrap };
  }

  async #unwrapDataKey(dataKey: DataKeyOutput, userId: string): Promise<Buffer> {
    const parsed = this.#parseWrappedKey(dataKey.wrappedKey, userId);

    if (parsed.header.kid !== this.kmsTarget.kid) {
      throw this.#rejectUnavailable("USER_DATA_KEY_WRAPPED_UNDER_UNKNOWN_KID", {
        userId,
        received: parsed.header.kid,
        expected: this.kmsTarget.kid
      });
    }

    const key = await this.#openWrappedKey(parsed, userId);

    if (key.length !== DATA_ENCRYPTION_KEY_BYTES) {
      throw this.#rejectUnreadable("USER_DATA_KEY_LENGTH_UNEXPECTED", { userId, keyBytes: key.length });
    }

    this.#loggerService.info({ event: "USER_DATA_KEY_UNWRAPPED", userId, dataKeyId: dataKey.id });

    return key;
  }

  #parseWrappedKey(wrappedKey: string, userId: string): ParsedKmsWrappedJwe {
    try {
      return this.wrappedJweService.parse(wrappedKey);
    } catch (error) {
      throw this.#rejectWrappedJweFailure(error, userId);
    }
  }

  async #openWrappedKey(parsed: ParsedKmsWrappedJwe, userId: string): Promise<Buffer> {
    try {
      return await this.wrappedJweService.open(parsed);
    } catch (error) {
      throw this.#rejectWrappedJweFailure(error, userId);
    }
  }

  /** A wrapped data key is our own row, so nothing about it is ever reported as the caller's mistake. */
  #rejectWrappedJweFailure(error: unknown, userId: string) {
    if (!(error instanceof KmsWrappedJweError)) return error;

    const details = { userId, failure: error.failure, ...error.details };

    if (KEY_SERVICE_FAILURES.has(error.failure)) {
      return this.#rejectUnavailable("USER_DATA_KEY_UNWRAP_FAILED", details);
    }

    return this.#rejectUnreadable("USER_DATA_KEY_UNREADABLE", details);
  }

  #rejectUnreadable(event: string, details: Record<string, unknown>) {
    this.#loggerService.error({ event, ...details });

    return createError(500, SECRET_UNREADABLE_ERROR_MESSAGE);
  }

  #rejectUnavailable(event: string, details: Record<string, unknown>) {
    this.#loggerService.error({ event, ...details });

    return createError(503, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE);
  }
}
