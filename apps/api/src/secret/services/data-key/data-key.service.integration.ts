import { compactDecrypt } from "jose";
import { generateKeyPairSync } from "node:crypto";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger } from "@src/core/providers/logging.provider";
import type { SdlSecretsSealingKeyService } from "@src/deployment/services/sdl-secrets-sealing-key/sdl-secrets-sealing-key.service";
import { DataKeyRepository } from "@src/secret/repositories/data-key/data-key.repository";
import { UserRepository } from "@src/user/repositories";
import { DataKeyService } from "./data-key.service";

import { seedOrganization } from "@test/seeders/db/organization.seeder";

describe(DataKeyService.name, () => {
  it("creates a data key for a user that never had one", async () => {
    const { service, dataKeyRepository, createTestUser, privateKey } = setup();
    const user = await createTestUser();

    const dataKey = await service.ensureDataKey({ userId: user.id });

    expect(dataKey).toMatchObject({ userId: user.id, wrappedByKid: "sdl-secrets.v1" });
    expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
    expect((await compactDecrypt(dataKey.wrappedKey, privateKey)).plaintext).toHaveLength(32);
  });

  it("returns the same record on a second call rather than replacing it", async () => {
    const { service, dataKeyRepository, createTestUser } = setup();
    const user = await createTestUser();

    const first = await service.ensureDataKey({ userId: user.id });
    const second = await service.ensureDataKey({ userId: user.id });

    expect(second).toEqual(first);
    expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
  });

  it("leaves exactly one record when two concurrent calls both need a data key", async () => {
    const { service, dataKeyRepository, createTestUser, privateKey } = setup();
    const user = await createTestUser();

    const [first, second] = await Promise.all([service.ensureDataKey({ userId: user.id }), service.ensureDataKey({ userId: user.id })]);

    expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
    expect(first.id).toBe(second.id);

    const firstPlaintext = (await compactDecrypt(first.wrappedKey, privateKey)).plaintext;
    const secondPlaintext = (await compactDecrypt(second.wrappedKey, privateKey)).plaintext;

    expect(firstPlaintext).toHaveLength(32);
    expect(Buffer.from(firstPlaintext).equals(Buffer.from(secondPlaintext))).toBe(true);
  });

  describe("for a team", () => {
    it("creates the team's own key on the first value sealed for it", async () => {
      const { service, dataKeyRepository, privateKey } = setup();
      const team = await seedOrganization();

      const dataKey = await service.ensureDataKey({ organizationId: team.id });

      expect(dataKey).toMatchObject({ organizationId: team.id, userId: null, wrappedByKid: "sdl-secrets.v1" });
      expect(await dataKeyRepository.count({ organizationId: team.id })).toBe(1);
      expect((await compactDecrypt(dataKey.wrappedKey, privateKey)).plaintext).toHaveLength(32);
    });

    it("leaves the team one key however many seals race to create it", async () => {
      const { service, dataKeyRepository, privateKey } = setup();
      const team = await seedOrganization();

      const keys = await Promise.all(Array.from({ length: 8 }, () => service.ensureDataKey({ organizationId: team.id })));

      expect(new Set(keys.map(key => key.id)).size).toBe(1);
      expect(await dataKeyRepository.count({ organizationId: team.id })).toBe(1);
      const plaintexts = await Promise.all(keys.map(async key => Buffer.from((await compactDecrypt(key.wrappedKey, privateKey)).plaintext).toString("hex")));
      expect(new Set(plaintexts).size).toBe(1);
    });

    it("keeps a member's key and the team's key apart", async () => {
      const { service, createTestUser } = setup();
      const member = await createTestUser();
      const team = await seedOrganization({ createdByUserId: member.id });

      const [membersKey, teamsKey] = await Promise.all([service.ensureDataKey({ userId: member.id }), service.ensureDataKey({ organizationId: team.id })]);

      expect(membersKey.id).not.toBe(teamsKey.id);
      expect(membersKey).toMatchObject({ userId: member.id, organizationId: null });
      expect(teamsKey).toMatchObject({ userId: null, organizationId: team.id });
    });
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
    const service = new DataKeyService(dataKeyRepository, sealingKeyService, () => mock<ReturnType<CreateLogger>>());
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
