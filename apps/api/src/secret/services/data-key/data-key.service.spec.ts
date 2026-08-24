import { faker } from "@faker-js/faker";
import crc32c from "fast-crc32c";
import { compactDecrypt, decodeProtectedHeader } from "jose";
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import type { LoggerService } from "@src/core/providers/logging.provider";
import { SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { DataKeyOutput, DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "./data-key.service";

describe(DataKeyService.name, () => {
  describe("ensureDataKey", () => {
    it("wraps a 256-bit data key that only the KMS private key can open", async () => {
      const { service, privateKey, warmSealingKey } = setup();
      await warmSealingKey();

      const dataKey = await service.ensureDataKey(faker.string.uuid());
      const { plaintext } = await compactDecrypt(dataKey.wrappedKey, privateKey);

      expect(plaintext).toHaveLength(32);
      expect(dataKey.wrappedKey).not.toContain(Buffer.from(plaintext).toString("base64url"));
      expect(dataKey.wrappedKey).not.toContain(Buffer.from(plaintext).toString("hex"));
    });

    it("cannot be opened by a private key other than the sealing key's", async () => {
      const { service, warmSealingKey } = setup();
      const foreignPrivateKey = generateKeyPairSync("rsa", { modulusLength: 3072 }).privateKey;
      await warmSealingKey();

      const dataKey = await service.ensureDataKey(faker.string.uuid());

      await expect(compactDecrypt(dataKey.wrappedKey, foreignPrivateKey)).rejects.toThrow();
    });

    it("stores the key version alias the wrapped blob itself names", async () => {
      const { service, warmSealingKey } = setup({ kid: "sdl-secrets.v4" });
      await warmSealingKey();

      const dataKey = await service.ensureDataKey(faker.string.uuid());

      expect(dataKey.wrappedByKid).toBe("sdl-secrets.v4");
      expect(decodeProtectedHeader(dataKey.wrappedKey).kid).toBe(dataKey.wrappedByKid);
    });

    it("wraps with RSA-OAEP-256 over A256GCM content encryption", async () => {
      const { service, warmSealingKey } = setup();
      await warmSealingKey();

      const dataKey = await service.ensureDataKey(faker.string.uuid());

      expect(decodeProtectedHeader(dataKey.wrappedKey)).toMatchObject({ alg: "RSA-OAEP-256", enc: "A256GCM" });
    });

    it("makes no key-service call once the sealing key is held", async () => {
      const { service, kmsClient, warmSealingKey } = setup();
      await warmSealingKey();
      kmsClient.getPublicKey.mockClear();

      await service.ensureDataKey(faker.string.uuid());
      await service.ensureDataKey(faker.string.uuid());

      expect(kmsClient.getPublicKey).not.toHaveBeenCalled();
    });

    it("returns the existing data key without wrapping a new one", async () => {
      const { service, dataKeyRepository, warmSealingKey } = setup();
      await warmSealingKey();
      const userId = faker.string.uuid();
      const created = await service.ensureDataKey(userId);

      const found = await service.ensureDataKey(userId);

      expect(found).toEqual(created);
      expect(dataKeyRepository.createUnlessExists).toHaveBeenCalledTimes(1);
    });

    it("gives two users different data keys", async () => {
      const { service, privateKey, warmSealingKey } = setup();
      await warmSealingKey();

      const first = await service.ensureDataKey(faker.string.uuid());
      const second = await service.ensureDataKey(faker.string.uuid());

      const firstPlaintext = (await compactDecrypt(first.wrappedKey, privateKey)).plaintext;
      const secondPlaintext = (await compactDecrypt(second.wrappedKey, privateKey)).plaintext;

      expect(first.wrappedKey).not.toBe(second.wrappedKey);
      expect(Buffer.from(firstPlaintext).equals(Buffer.from(secondPlaintext))).toBe(false);
    });

    it("refuses to wrap a key while the sealing key is not held rather than waiting on the key service", async () => {
      const { service, dataKeyRepository, logger } = setup();
      const userId = faker.string.uuid();

      await expect(service.ensureDataKey(userId)).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });

      expect(dataKeyRepository.createUnlessExists).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({ event: "USER_DATA_KEY_SEALING_KEY_NOT_HELD", userId });
    });

    it("logs the creation without the key material", async () => {
      const { service, logger, warmSealingKey } = setup({ kid: "sdl-secrets.v1" });
      await warmSealingKey();
      const userId = faker.string.uuid();

      await service.ensureDataKey(userId);

      expect(logger.info).toHaveBeenCalledWith({ event: "USER_DATA_KEY_CREATED", userId, wrappedByKid: "sdl-secrets.v1" });
    });
  });

  function setup(input?: { kid?: string }) {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const versionName = "projects/console-test/locations/global/keyRings/console-api/cryptoKeys/sdl-secrets/cryptoKeyVersions/1";
    const kmsClient = mock<SdlSecretsKmsClient>();
    kmsClient.getPublicKey.mockResolvedValue([
      { pem, name: versionName, algorithm: "RSA_DECRYPT_OAEP_3072_SHA256", pemCrc32c: { value: String(crc32c.calculate(pem)) } }
    ]);

    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const sealingKeyService = new SdlSecretsSealingKeyService({ client: kmsClient, versionName, kid: input?.kid ?? "sdl-secrets.v1" }, createLogger);

    const storedByUserId = new Map<string, DataKeyOutput>();
    const dataKeyRepository = mock<DataKeyRepository>();
    dataKeyRepository.findByUserId.mockImplementation(async userId => storedByUserId.get(userId));
    dataKeyRepository.createUnlessExists.mockImplementation(async record => {
      const existing = storedByUserId.get(record.userId);

      if (existing) return { dataKey: existing, isNew: false };

      const dataKey: DataKeyOutput = { id: faker.string.uuid(), createdAt: new Date(), updatedAt: new Date(), ...record };
      storedByUserId.set(record.userId, dataKey);

      return { dataKey, isNew: true };
    });

    const logger = mock<LoggerService>();
    const service = new DataKeyService(dataKeyRepository, sealingKeyService, logger);

    return {
      service,
      dataKeyRepository,
      sealingKeyService,
      kmsClient,
      logger,
      privateKey,
      publicKey,
      warmSealingKey: () => sealingKeyService.getSealingKey()
    };
  }
});
