import createError from "http-errors";
import { compactDecrypt, CompactEncrypt, decodeProtectedHeader } from "jose";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { SECRET_AT_REST_CONTENT_ENCRYPTION, SECRET_AT_REST_KEY_MANAGEMENT, SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * What a stored value is bound to besides its data key, as extra protected-header claims a reader has to
 * state again to open it. The header is the additional authenticated data, so a claim is bound by the tag
 * rather than merely written down: a value moved to a row these claims do not describe fails to open.
 */
export type SecretBinding = Readonly<Record<string, string>>;

/** The claims that describe the encryption rather than what was encrypted, so they are the cipher's to set and not a binding's. */
const ENCRYPTION_HEADER_CLAIMS: ReadonlySet<string> = new Set(["alg", "enc", "kid"]);

/** The protected header names the data key record and is itself the additional authenticated data, so the recorded name cannot be swapped without breaking the tag. */
@singleton()
export class SecretCipherService {
  readonly #loggerService: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyUnwrapperService: DataKeyUnwrapperService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#loggerService = createLogger({ context: SecretCipherService.name });
  }

  /** The binding is spread first so the three claims that describe the encryption itself are always the ones that win, and no caller can weaken them by naming them. */
  async encrypt(userId: string, value: string, binding: SecretBinding): Promise<string> {
    const dataKey = await this.dataKeyUnwrapperService.getDataKey(userId);

    return await new CompactEncrypt(textEncoder.encode(value))
      .setProtectedHeader({ ...binding, alg: SECRET_AT_REST_KEY_MANAGEMENT, enc: SECRET_AT_REST_CONTENT_ENCRYPTION, kid: dataKey.id })
      .encrypt(await dataKey.unwrap());
  }

  /**
   * Everything free happens before anything costly: the header decides whether this value belongs here at
   * all, so a value the caller cannot own costs neither a data key lookup nor a key-service call.
   */
  async decrypt(userId: string, encrypted: string, binding: SecretBinding): Promise<string> {
    const { kid } = this.#readBoundHeader(encrypted, userId, binding);
    const dataKey = await this.dataKeyUnwrapperService.getDataKey(userId);

    if (kid !== dataKey.id) {
      throw this.#rejectUnreadable("SECRET_VALUE_DATA_KEY_MISMATCH", { userId, received: kid, expected: dataKey.id });
    }

    return textDecoder.decode(await this.#open(encrypted, await dataKey.unwrap(), userId));
  }

  /**
   * A reader has to name exactly what the value was bound to, not merely a subset of it. Checking only the
   * claims the caller thought to mention would let a later caller drop a binding by omission — passing
   * `{ sub }` for a value bound to `{ sub, dseq }` would open every deployment of that owner — so the
   * claim sets have to match before any value is compared.
   */
  #readBoundHeader(encrypted: string, userId: string, binding: SecretBinding) {
    const header = this.#decodeHeader(encrypted, userId);

    if (header.alg !== SECRET_AT_REST_KEY_MANAGEMENT || header.enc !== SECRET_AT_REST_CONTENT_ENCRYPTION) {
      throw this.#rejectUnreadable("SECRET_VALUE_ALGORITHM_UNSUPPORTED", { userId, alg: header.alg, enc: header.enc });
    }

    const bound = Object.keys(header).filter(claim => !ENCRYPTION_HEADER_CLAIMS.has(claim));

    if (bound.length !== Object.keys(binding).length || bound.some(claim => !Object.hasOwn(binding, claim))) {
      throw this.#rejectUnreadable("SECRET_VALUE_BINDING_UNACCOUNTED", { userId, bound, named: Object.keys(binding) });
    }

    for (const [claim, expected] of Object.entries(binding)) {
      if (header[claim] !== expected) {
        throw this.#rejectUnreadable("SECRET_VALUE_BINDING_MISMATCH", { userId, claim, received: header[claim], expected });
      }
    }

    return header;
  }

  #decodeHeader(encrypted: string, userId: string) {
    try {
      return decodeProtectedHeader(encrypted);
    } catch {
      throw this.#rejectUnreadable("SECRET_VALUE_HEADER_UNREADABLE", { userId });
    }
  }

  async #open(encrypted: string, key: Buffer, userId: string): Promise<Uint8Array> {
    try {
      const { plaintext } = await compactDecrypt(encrypted, key, {
        keyManagementAlgorithms: [SECRET_AT_REST_KEY_MANAGEMENT],
        contentEncryptionAlgorithms: [SECRET_AT_REST_CONTENT_ENCRYPTION]
      });

      return plaintext;
    } catch (error) {
      throw this.#rejectUnreadable("SECRET_VALUE_UNREADABLE", { userId, error });
    }
  }

  #rejectUnreadable(event: string, details: Record<string, unknown>) {
    this.#loggerService.error({ event, ...details });

    return createError(500, SECRET_UNREADABLE_ERROR_MESSAGE);
  }
}
