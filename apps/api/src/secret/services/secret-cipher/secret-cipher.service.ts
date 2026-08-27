import createError from "http-errors";
import { compactDecrypt, CompactEncrypt, decodeProtectedHeader } from "jose";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { SECRET_AT_REST_CONTENT_ENCRYPTION, SECRET_AT_REST_KEY_MANAGEMENT, SECRET_UNREADABLE_ERROR_MESSAGE } from "@src/secret/config/secret-at-rest.config";
import { DataKeyUnwrapperService } from "@src/secret/services/data-key-unwrapper/data-key-unwrapper.service";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

  async encrypt(userId: string, value: string): Promise<string> {
    const dataKey = await this.dataKeyUnwrapperService.getDataKey(userId);

    return await new CompactEncrypt(textEncoder.encode(value))
      .setProtectedHeader({ alg: SECRET_AT_REST_KEY_MANAGEMENT, enc: SECRET_AT_REST_CONTENT_ENCRYPTION, kid: dataKey.id })
      .encrypt(await dataKey.unwrap());
  }

  /** The recorded data key is checked before the key is unwrapped, so reading a value the user cannot own costs no key-service call. */
  async decrypt(userId: string, encrypted: string): Promise<string> {
    const kid = this.#readDataKeyId(encrypted, userId);
    const dataKey = await this.dataKeyUnwrapperService.getDataKey(userId);

    if (kid !== dataKey.id) {
      throw this.#rejectUnreadable("SECRET_VALUE_DATA_KEY_MISMATCH", { userId, received: kid, expected: dataKey.id });
    }

    return textDecoder.decode(await this.#open(encrypted, await dataKey.unwrap(), userId));
  }

  #readDataKeyId(encrypted: string, userId: string) {
    try {
      return decodeProtectedHeader(encrypted).kid;
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
