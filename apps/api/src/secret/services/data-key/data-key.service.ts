import createError from "http-errors";
import { CompactEncrypt } from "jose";
import { randomBytes } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE } from "@src/deployment/config/sdl-secrets.config";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { DataKeyInput, DataKeyOutput } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";

/** AES-256 content encryption, so the data encryption key is 256 bits. */
const DATA_ENCRYPTION_KEY_BYTES = 32;

/**
 * Hands out a user's data encryption key, creating it on first need. Wrapping uses only the public
 * half of the KMS key, and only the copy already held in memory, so signup neither calls the key
 * service nor waits on its availability — and users who registered before data keys existed get one
 * lazily instead of through a backfill.
 */
@singleton()
export class DataKeyService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly dataKeyRepository: DataKeyRepository,
    private readonly sealingKeyService: SdlSecretsSealingKeyService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DataKeyService.name });
  }

  async ensureDataKey(userId: string): Promise<DataKeyOutput> {
    const existing = await this.dataKeyRepository.findByUserId(userId);

    if (existing) return existing;

    const { dataKey, isNew } = await this.dataKeyRepository.createUnlessExists(await this.wrapNewDataKey(userId));

    if (isNew) {
      this.logger.info({ event: "USER_DATA_KEY_CREATED", userId, wrappedByKid: dataKey.wrappedByKid });
    }

    return dataKey;
  }

  private async wrapNewDataKey(userId: string): Promise<Pick<DataKeyInput, "userId" | "wrappedKey" | "wrappedByKid">> {
    const sealingKey = this.sealingKeyService.peekSealingKey();

    if (!sealingKey) {
      this.logger.error({ event: "USER_DATA_KEY_SEALING_KEY_NOT_HELD", userId });

      throw createError(503, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE);
    }

    const { kid, publicKey } = sealingKey;
    const wrappedKey = await new CompactEncrypt(randomBytes(DATA_ENCRYPTION_KEY_BYTES))
      .setProtectedHeader({ alg: SDL_SECRETS_SEAL_ALGORITHM, enc: SDL_SECRETS_CONTENT_ENCRYPTION, kid })
      .encrypt(publicKey);

    return { userId, wrappedKey, wrappedByKid: kid };
  }
}
