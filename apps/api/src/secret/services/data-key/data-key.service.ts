import createError from "http-errors";
import { CompactEncrypt } from "jose";
import { randomBytes } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { SDL_SECRETS_CONTENT_ENCRYPTION, SDL_SECRETS_SEAL_ALGORITHM, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsSealingKey } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { DataKeyInput, DataKeyOutput, DataKeyOwner } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";

/** AES-256 content encryption, so the data encryption key is 256 bits. */
const DATA_ENCRYPTION_KEY_BYTES = 32;

/** A fresh key wrapped under the sealing key's public half, so minting one spends no key-service call. */
export async function wrapDataKey({ kid, publicKey }: SdlSecretsSealingKey): Promise<Pick<DataKeyInput, "wrappedKey" | "wrappedByKid">> {
  const wrappedKey = await new CompactEncrypt(randomBytes(DATA_ENCRYPTION_KEY_BYTES))
    .setProtectedHeader({ alg: SDL_SECRETS_SEAL_ALGORITHM, enc: SDL_SECRETS_CONTENT_ENCRYPTION, kid })
    .encrypt(publicKey);

  return { wrappedKey, wrappedByKid: kid };
}

/**
 * Hands out a user's or a team's data encryption key, creating it on first need. Wrapping uses only the public
 * half of the KMS key, and only the copy already held in memory, so signup neither calls the key
 * service nor waits on its availability — and users who registered before data keys existed get one
 * lazily instead of through a backfill, as does a team on the first value sealed for it.
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

  async ensureDataKey(owner: DataKeyOwner): Promise<DataKeyOutput> {
    const existing = await this.dataKeyRepository.findActiveOf(owner);

    if (existing) return existing;

    const { dataKey, isNew } = await this.dataKeyRepository.createUnlessExists({ ...owner, ...(await this.wrapNewDataKey(owner)) });

    if (isNew) {
      const event = owner.organizationId === undefined ? "USER_DATA_KEY_CREATED" : "ORGANIZATION_DATA_KEY_CREATED";
      this.logger.info({ event, ...owner, wrappedByKid: dataKey.wrappedByKid });
    }

    return dataKey;
  }

  /** Reading never creates a key: a value can only have been sealed under one that already exists. */
  async findActiveDataKey(owner: DataKeyOwner): Promise<DataKeyOutput | undefined> {
    return await this.dataKeyRepository.findActiveOf(owner);
  }

  /** A key of the owner's other than the active one: retired while its values are re-sealed, or made active after the caller read the row. */
  async findDataKeyById(owner: DataKeyOwner, id: string): Promise<DataKeyOutput | undefined> {
    return await this.dataKeyRepository.findOwnedById(owner, id);
  }

  private async wrapNewDataKey(owner: DataKeyOwner): Promise<Pick<DataKeyInput, "wrappedKey" | "wrappedByKid">> {
    const sealingKey = this.sealingKeyService.peekSealingKey();

    if (!sealingKey) {
      this.logger.error({ event: "USER_DATA_KEY_SEALING_KEY_NOT_HELD", ...owner });

      throw createError(503, SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE);
    }

    return await wrapDataKey(sealingKey);
  }
}
