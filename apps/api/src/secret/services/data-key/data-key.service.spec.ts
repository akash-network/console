import { faker } from "@faker-js/faker";
import crc32c from "fast-crc32c";
import { compactDecrypt, decodeProtectedHeader } from "jose";
import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core";
import { SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE } from "@src/deployment/config/sdl-secrets.config";
import type { SdlSecretsKmsClient } from "@src/deployment/providers/kms.provider";
import { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import type { DataKeyOutput, DataKeyOwner, DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { DataKeyService } from "./data-key.service";

import { createTestSdlSecretsKmsTarget, sdlSecretsVersionPath } from "@test/mocks/sdl-secrets-kms.mock";
import { createDataKey } from "@test/seeders/data-key.seeder";

const WRAPPING_KEY_PAIR = generateKeyPairSync("rsa", { modulusLength: 3072 });
const FOREIGN_KEY_PAIR = generateKeyPairSync("rsa", { modulusLength: 3072 });

describe(DataKeyService.name, () => {
  describe("ensureDataKey", () => {
    it("wraps a 256-bit data key that only the KMS private key can open", async () => {
      const { service, privateKey, warmSealingKey } = setup();
      await warmSealingKey();

      const dataKey = await service.ensureDataKey({ userId: faker.string.uuid() });
      const { plaintext } = await compactDecrypt(dataKey.wrappedKey, privateKey);

      expect(plaintext).toHaveLength(32);
      expect(dataKey.wrappedKey).not.toContain(Buffer.from(plaintext).toString("base64url"));
      expect(dataKey.wrappedKey).not.toContain(Buffer.from(plaintext).toString("hex"));
    });

    it("cannot be opened by a private key other than the sealing key's", async () => {
      const { service, warmSealingKey } = setup();
      const foreignPrivateKey = FOREIGN_KEY_PAIR.privateKey;
      await warmSealingKey();

      const dataKey = await service.ensureDataKey({ userId: faker.string.uuid() });

      await expect(compactDecrypt(dataKey.wrappedKey, foreignPrivateKey)).rejects.toThrow();
    });

    it("stores the key version alias the wrapped blob itself names", async () => {
      const { service, warmSealingKey } = setup({ version: "4" });
      await warmSealingKey();

      const dataKey = await service.ensureDataKey({ userId: faker.string.uuid() });

      expect(dataKey.wrappedByKid).toBe("sdl-secrets.v4");
      expect(decodeProtectedHeader(dataKey.wrappedKey).kid).toBe(dataKey.wrappedByKid);
    });

    it("wraps with RSA-OAEP-256 over A256GCM content encryption", async () => {
      const { service, warmSealingKey } = setup();
      await warmSealingKey();

      const dataKey = await service.ensureDataKey({ userId: faker.string.uuid() });

      expect(decodeProtectedHeader(dataKey.wrappedKey)).toMatchObject({ alg: "RSA-OAEP-256", enc: "A256GCM" });
    });

    it("makes no key-service call once the sealing key is held", async () => {
      const { service, kmsClient, warmSealingKey } = setup();
      await warmSealingKey();
      kmsClient.getPublicKey.mockClear();

      await service.ensureDataKey({ userId: faker.string.uuid() });
      await service.ensureDataKey({ userId: faker.string.uuid() });

      expect(kmsClient.getPublicKey).not.toHaveBeenCalled();
    });

    it("returns the existing data key without wrapping a new one", async () => {
      const { service, dataKeyRepository, warmSealingKey } = setup();
      await warmSealingKey();
      const userId = faker.string.uuid();
      const created = await service.ensureDataKey({ userId });

      const found = await service.ensureDataKey({ userId });

      expect(found).toEqual(created);
      expect(dataKeyRepository.createUnlessExists).toHaveBeenCalledTimes(1);
    });

    it("gives two users different data keys", async () => {
      const { service, privateKey, warmSealingKey } = setup();
      await warmSealingKey();

      const first = await service.ensureDataKey({ userId: faker.string.uuid() });
      const second = await service.ensureDataKey({ userId: faker.string.uuid() });

      const firstPlaintext = (await compactDecrypt(first.wrappedKey, privateKey)).plaintext;
      const secondPlaintext = (await compactDecrypt(second.wrappedKey, privateKey)).plaintext;

      expect(first.wrappedKey).not.toBe(second.wrappedKey);
      expect(Buffer.from(firstPlaintext).equals(Buffer.from(secondPlaintext))).toBe(false);
    });

    it("refuses to wrap a key while the sealing key is not held rather than waiting on the key service", async () => {
      const { service, dataKeyRepository, logger } = setup();
      const userId = faker.string.uuid();

      await expect(service.ensureDataKey({ userId })).rejects.toMatchObject({ status: 503, message: SDL_SECRETS_UNAVAILABLE_ERROR_MESSAGE });

      expect(dataKeyRepository.createUnlessExists).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith({ event: "USER_DATA_KEY_SEALING_KEY_NOT_HELD", userId });
    });

    it("logs the creation without the key material", async () => {
      const { service, logger, warmSealingKey } = setup({ version: "1" });
      await warmSealingKey();
      const userId = faker.string.uuid();

      await service.ensureDataKey({ userId });

      expect(logger.info).toHaveBeenCalledWith({ event: "USER_DATA_KEY_CREATED", userId, wrappedByKid: "sdl-secrets.v1" });
    });

    describe("for a team", () => {
      it("creates the team's own key on first need, owned by the team alone", async () => {
        const { service, dataKeyRepository, privateKey, warmSealingKey } = setup();
        await warmSealingKey();
        const organizationId = faker.string.uuid();

        const dataKey = await service.ensureDataKey({ organizationId });

        expect(dataKey).toMatchObject({ organizationId, userId: null });
        expect(dataKeyRepository.createUnlessExists).toHaveBeenCalledWith({
          organizationId,
          wrappedKey: dataKey.wrappedKey,
          wrappedByKid: dataKey.wrappedByKid
        });
        expect((await compactDecrypt(dataKey.wrappedKey, privateKey)).plaintext).toHaveLength(32);
      });

      it("returns the team's existing key rather than a member's under the same id", async () => {
        const { service, dataKeyRepository, warmSealingKey } = setup();
        await warmSealingKey();
        const sharedId = faker.string.uuid();
        const membersKey = await service.ensureDataKey({ userId: sharedId });

        const teamsKey = await service.ensureDataKey({ organizationId: sharedId });

        expect(teamsKey.id).not.toBe(membersKey.id);
        expect(await service.ensureDataKey({ organizationId: sharedId })).toEqual(teamsKey);
        expect(dataKeyRepository.findActiveOf).toHaveBeenCalledWith({ organizationId: sharedId });
        expect(dataKeyRepository.createUnlessExists).toHaveBeenCalledTimes(2);
      });

      it("logs the team's key creation apart from a user's", async () => {
        const { service, logger, warmSealingKey } = setup({ version: "1" });
        await warmSealingKey();
        const organizationId = faker.string.uuid();

        await service.ensureDataKey({ organizationId });

        expect(logger.info).toHaveBeenCalledWith({ event: "ORGANIZATION_DATA_KEY_CREATED", organizationId, wrappedByKid: "sdl-secrets.v1" });
      });

      it("logs nothing as created when another writer created the team's key first", async () => {
        const { service, dataKeyRepository, logger, warmSealingKey } = setup();
        await warmSealingKey();
        const organizationId = faker.string.uuid();
        const winner = createDataKey({ userId: null, organizationId });
        dataKeyRepository.findActiveOf.mockResolvedValueOnce(undefined);
        dataKeyRepository.createUnlessExists.mockResolvedValueOnce({ dataKey: winner, isNew: false });

        await expect(service.ensureDataKey({ organizationId })).resolves.toBe(winner);
        expect(logger.info).not.toHaveBeenCalled();
      });
    });
  });

  describe("findDataKeyById", () => {
    it("answers with the key the owner holds under that id, retired or not", async () => {
      const { service, dataKeyRepository } = setup();
      const owner = { organizationId: faker.string.uuid() };
      const retired = createDataKey({ userId: null, ...owner, retiredAt: new Date() });
      dataKeyRepository.findOwnedById.mockResolvedValue(retired);

      const found = await service.findDataKeyById(owner, retired.id);

      expect(found).toBe(retired);
      expect(dataKeyRepository.findOwnedById).toHaveBeenCalledWith(owner, retired.id);
    });

    it("answers with nothing for a key the owner does not hold", async () => {
      const { service, dataKeyRepository } = setup();
      dataKeyRepository.findOwnedById.mockResolvedValue(undefined);

      await expect(service.findDataKeyById({ userId: faker.string.uuid() }, faker.string.uuid())).resolves.toBeUndefined();
    });
  });

  describe("findActiveDataKey", () => {
    it("answers with the owner's active key without creating one", async () => {
      const { service, dataKeyRepository } = setup();
      const owner = { organizationId: faker.string.uuid() };
      const active = createDataKey({ userId: null, ...owner });
      dataKeyRepository.findActiveOf.mockResolvedValue(active);

      await expect(service.findActiveDataKey(owner)).resolves.toBe(active);
      expect(dataKeyRepository.findActiveOf).toHaveBeenCalledWith(owner);
      expect(dataKeyRepository.createUnlessExists).not.toHaveBeenCalled();
    });
  });

  it("creates the logger with the service context", () => {
    const { createDataKeyLogger } = setup();

    expect(createDataKeyLogger).toHaveBeenCalledWith({ context: DataKeyService.name });
  });

  function setup(input?: { version?: string }) {
    const { publicKey, privateKey } = WRAPPING_KEY_PAIR;
    const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
    const versionName = sdlSecretsVersionPath(input?.version ?? "1");
    const kmsClient = mock<SdlSecretsKmsClient>();
    kmsClient.getPublicKey.mockResolvedValue([
      { pem, name: versionName, algorithm: "RSA_DECRYPT_OAEP_3072_SHA256", pemCrc32c: { value: String(crc32c.calculate(pem)) } }
    ]);

    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const sealingKeyService = new SdlSecretsSealingKeyService(createTestSdlSecretsKmsTarget({ client: kmsClient, version: input?.version }), createLogger);

    const storedByOwner = new Map<string, DataKeyOutput>();
    const ownerIdOf = (owner: DataKeyOwner) => (owner.organizationId === undefined ? `user:${owner.userId}` : `organization:${owner.organizationId}`);
    const dataKeyRepository = mock<DataKeyRepository>();
    dataKeyRepository.findActiveOf.mockImplementation(async owner => storedByOwner.get(ownerIdOf(owner)));
    dataKeyRepository.createUnlessExists.mockImplementation(async record => {
      const existing = storedByOwner.get(ownerIdOf(record));

      if (existing) return { dataKey: existing, isNew: false };

      const dataKey: DataKeyOutput = {
        id: faker.string.uuid(),
        userId: record.userId ?? null,
        organizationId: record.organizationId ?? null,
        wrappedKey: record.wrappedKey,
        wrappedByKid: record.wrappedByKid,
        retiredAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      storedByOwner.set(ownerIdOf(record), dataKey);

      return { dataKey, isNew: true };
    });

    const logger = mock<ReturnType<CreateLogger>>();
    const createDataKeyLogger = vi.fn<CreateLogger>(() => logger);
    const service = new DataKeyService(dataKeyRepository, sealingKeyService, createDataKeyLogger);

    return {
      service,
      dataKeyRepository,
      sealingKeyService,
      kmsClient,
      logger,
      createDataKeyLogger,
      privateKey,
      publicKey,
      warmSealingKey: () => sealingKeyService.getSealingKey()
    };
  }
});
