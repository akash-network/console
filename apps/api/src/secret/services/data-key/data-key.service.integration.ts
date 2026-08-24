import { compactDecrypt } from "jose";
import { generateKeyPairSync } from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { LoggerService } from "@src/core/providers/logging.provider";
import type { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { UserRepository } from "@src/user/repositories";
import { DataKeyService } from "./data-key.service";

describe(DataKeyService.name, () => {
  it("creates a data key for a user that never had one", async () => {
    const { service, dataKeyRepository, createTestUser, privateKey } = setup();
    const user = await createTestUser();

    const dataKey = await service.ensureDataKey(user.id);

    expect(dataKey).toMatchObject({ userId: user.id, wrappedByKid: "sdl-secrets.v1" });
    expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
    expect((await compactDecrypt(dataKey.wrappedKey, privateKey)).plaintext).toHaveLength(32);
  });

  it("returns the same record on a second call rather than replacing it", async () => {
    const { service, dataKeyRepository, createTestUser } = setup();
    const user = await createTestUser();

    const first = await service.ensureDataKey(user.id);
    const second = await service.ensureDataKey(user.id);

    expect(second).toEqual(first);
    expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
  });

  it("leaves exactly one record when two concurrent calls both need a data key", async () => {
    const { service, dataKeyRepository, createTestUser, privateKey } = setup();
    const user = await createTestUser();

    const [first, second] = await Promise.all([service.ensureDataKey(user.id), service.ensureDataKey(user.id)]);

    expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
    expect(first.id).toBe(second.id);

    const firstPlaintext = (await compactDecrypt(first.wrappedKey, privateKey)).plaintext;
    const secondPlaintext = (await compactDecrypt(second.wrappedKey, privateKey)).plaintext;

    expect(firstPlaintext).toHaveLength(32);
    expect(Buffer.from(firstPlaintext).equals(Buffer.from(secondPlaintext))).toBe(true);
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    await cleanup?.();
  });

  function setup() {
    const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 3072 });
    const { n, e } = publicKey.export({ format: "jwk" });
    const sealingKeyService = mock<SdlSecretsSealingKeyService>();
    sealingKeyService.peekSealingKey.mockReturnValue({
      kid: "sdl-secrets.v1",
      publicKey,
      jwk: { kty: "RSA", n: n!, e: e!, use: "enc", alg: "RSA-OAEP-256" }
    });

    const dataKeyRepository = container.resolve(DataKeyRepository);
    const userRepository = container.resolve(UserRepository);
    const service = new DataKeyService(dataKeyRepository, sealingKeyService, mock<LoggerService>());
    const createdUserIds: string[] = [];

    cleanup = async () => {
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    };

    async function createTestUser() {
      const user = await userRepository.create({});
      createdUserIds.push(user.id);
      return user;
    }

    return { service, dataKeyRepository, userRepository, createTestUser, privateKey, sealingKeyService };
  }
});
