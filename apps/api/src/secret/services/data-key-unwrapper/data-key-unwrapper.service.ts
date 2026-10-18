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
import type { DataKeyOutput, DataKeyOwner } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "@src/secret/services/data-key/data-key.service";
import { DataKeyUnwrapInstrumentationService } from "./data-key-unwrap-instrumentation.service";

/** AES-256 content encryption, so the data encryption key is 256 bits. */
const DATA_ENCRYPTION_KEY_BYTES = 32;

/** Retrying reaches a key service that has recovered; every other failure means the stored row itself is unusable. */
const KEY_SERVICE_FAILURES: ReadonlySet<KmsWrappedJweFailure> = new Set([
  "KEY_SERVICE_UNREACHABLE",
  "KEY_SERVICE_REFUSED",
  "KEY_SERVICE_REQUEST_CORRUPTED",
  "KEY_SERVICE_PLAINTEXT_MISSING",
  "KEY_SERVICE_RESPONSE_CORRUPTED"
]);

/** A user's key and a team's key are held apart whatever their ids. */
function heldOwnerOf(owner: DataKeyOwner) {
  return owner.organizationId === undefined ? `user:${owner.userId}` : `organization:${owner.organizationId}`;
}

/** The active key is held under its owner alone and any other key under the owner and its id, so a request never confuses the two. */
function heldKeyFor(owner: DataKeyOwner, dataKeyId: string) {
  return `${heldOwnerOf(owner)}/${dataKeyId}`;
}

/** Never holds an unwrapped key on this instance, because a resolution-scoped field would be pinned for the process lifetime by the first singleton to inject it. */
@singleton()
export class DataKeyUnwrapperService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyService: DataKeyService,
    private readonly executionContextService: ExecutionContextService,
    private readonly wrappedJweService: KmsWrappedJweService,
    private readonly unwrapInstrumentationService: DataKeyUnwrapInstrumentationService,
    @inject(SDL_SECRETS_KMS_TARGET) private readonly kmsTarget: SdlSecretsKmsTarget,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: DataKeyUnwrapperService.name });
  }

  async getDataKey(userId: string): Promise<HeldDataKey> {
    const owner = { userId };

    return await this.#holdOnce(owner, heldOwnerOf(owner), async () => await this.dataKeyService.ensureDataKey(userId));
  }

  /** The active key without creating one, held as `getDataKey` holds it; undefined when the owner has none. */
  async findDataKey(owner: DataKeyOwner): Promise<HeldDataKey | undefined> {
    return await this.#holdOnce(owner, heldOwnerOf(owner), async () => await this.dataKeyService.findActiveDataKey(owner));
  }

  /** Serves a value sealed under a key other than the active one, such as one retired while its values are re-sealed; undefined when the owner holds no such key. */
  async getDataKeyById(owner: DataKeyOwner, dataKeyId: string): Promise<HeldDataKey | undefined> {
    return await this.#holdOnce(owner, heldKeyFor(owner, dataKeyId), async () => await this.dataKeyService.findDataKeyById(owner, dataKeyId));
  }

  /** Callers racing for the same key share one holding from before the row is read, so the row is read and the key unwrapped once for the request; a miss is forgotten so the next ask reads again. */
  #holdOnce(owner: DataKeyOwner, heldAs: string, readDataKey: () => Promise<DataKeyOutput>): Promise<HeldDataKey>;
  #holdOnce(owner: DataKeyOwner, heldAs: string, readDataKey: () => Promise<DataKeyOutput | undefined>): Promise<HeldDataKey | undefined>;
  async #holdOnce(owner: DataKeyOwner, heldAs: string, readDataKey: () => Promise<DataKeyOutput | undefined>): Promise<HeldDataKey | undefined> {
    const heldThisRequest = this.#heldDataKeys(owner);
    const held = heldThisRequest.get(heldAs);

    if (held) return await held;

    const holding = this.#holdDataKey(owner, readDataKey, heldThisRequest)
      .then(dataKey => {
        if (!dataKey) heldThisRequest.delete(heldAs);

        return dataKey;
      })
      .catch(error => {
        heldThisRequest.delete(heldAs);

        throw error;
      });

    heldThisRequest.set(heldAs, holding);

    return await holding;
  }

  #heldDataKeys(owner: DataKeyOwner) {
    if (!this.executionContextService.hasContext()) {
      throw this.#rejectUnreadable("USER_DATA_KEY_OUTSIDE_REQUEST", { ...owner });
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
  async #holdDataKey(
    owner: DataKeyOwner,
    readDataKey: () => Promise<DataKeyOutput | undefined>,
    heldThisRequest: Map<string, Promise<HeldDataKey | undefined>>
  ): Promise<HeldDataKey | undefined> {
    const dataKey = await readDataKey();

    if (!dataKey) return undefined;
    this.unwrapInstrumentationService.beginCountingUnwraps(heldOwnerOf(owner));
    let unwrapping: Promise<Buffer> | undefined;

    const unwrap = async () => {
      if (this.#currentlyHeldDataKeys() !== heldThisRequest) {
        unwrapping = undefined;

        throw this.#rejectUnreadable("USER_DATA_KEY_ESCAPED_REQUEST", { ...owner, dataKeyId: dataKey.id });
      }

      if (!unwrapping) {
        unwrapping = this.#unwrapDataKey(dataKey, owner).catch(error => {
          unwrapping = undefined;

          throw error;
        });
      }

      return await unwrapping;
    };

    return { id: dataKey.id, unwrap };
  }

  async #unwrapDataKey(dataKey: DataKeyOutput, owner: DataKeyOwner): Promise<Buffer> {
    const parsed = this.#parseWrappedKey(dataKey.wrappedKey, owner);
    const versionName = this.kmsTarget.resolveVersionName(parsed.header.kid);

    if (!versionName) {
      throw this.#rejectUnavailable("USER_DATA_KEY_WRAPPED_UNDER_UNKNOWN_KID", {
        ...owner,
        received: parsed.header.kid,
        expected: this.kmsTarget.kid
      });
    }

    const key = await this.#openWrappedKey(parsed, versionName, owner);

    if (key.length !== DATA_ENCRYPTION_KEY_BYTES) {
      throw this.#rejectUnreadable("USER_DATA_KEY_LENGTH_UNEXPECTED", { ...owner, keyBytes: key.length });
    }

    this.unwrapInstrumentationService.countUnwrap(heldOwnerOf(owner));
    this.#loggerService.info({ event: "USER_DATA_KEY_UNWRAPPED", ...owner, dataKeyId: dataKey.id, kid: parsed.header.kid });

    return key;
  }

  #parseWrappedKey(wrappedKey: string, owner: DataKeyOwner): ParsedKmsWrappedJwe {
    try {
      return this.wrappedJweService.parse(wrappedKey);
    } catch (error) {
      throw this.#rejectWrappedJweFailure(error, owner);
    }
  }

  async #openWrappedKey(parsed: ParsedKmsWrappedJwe, versionName: string, owner: DataKeyOwner): Promise<Buffer> {
    try {
      return await this.wrappedJweService.open(parsed, versionName);
    } catch (error) {
      throw this.#rejectWrappedJweFailure(error, owner);
    }
  }

  /** A wrapped data key is our own row, so nothing about it is ever reported as the caller's mistake. */
  #rejectWrappedJweFailure(error: unknown, owner: DataKeyOwner) {
    if (!(error instanceof KmsWrappedJweError)) return error;

    const details = { ...owner, failure: error.failure, ...error.details };

    if (error.failure === "WRAPPING_VERSION_UNUSABLE") {
      return this.#rejectUnavailable("USER_DATA_KEY_WRAPPED_UNDER_UNKNOWN_KID", { ...details, expected: this.kmsTarget.kid });
    }

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
