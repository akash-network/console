import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import { UserRepository } from "@src/user/repositories";
import { DataKeyRepository } from "./data-key.repository";

describe(DataKeyRepository.name, () => {
  describe("one data key per user", () => {
    it("rejects a second data key for the same user", async () => {
      const { dataKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      await dataKeyRepository.create({ userId: user.id, wrappedKey: wrappedKeyBlob(), wrappedByKid: keyVersionAlias() });

      await expect(dataKeyRepository.create({ userId: user.id, wrappedKey: wrappedKeyBlob(), wrappedByKid: keyVersionAlias() })).rejects.toThrow();

      expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
    });

    it("keeps each user's data key separate", async () => {
      const { dataKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const otherUser = await createTestUser();

      const first = await dataKeyRepository.createUnlessExists({ userId: user.id, wrappedKey: wrappedKeyBlob(), wrappedByKid: keyVersionAlias() });
      const second = await dataKeyRepository.createUnlessExists({ userId: otherUser.id, wrappedKey: wrappedKeyBlob(), wrappedByKid: keyVersionAlias() });

      expect(first.isNew).toBe(true);
      expect(second.isNew).toBe(true);
      expect(second.dataKey.id).not.toBe(first.dataKey.id);
    });
  });

  describe("createUnlessExists", () => {
    it("creates the record on first need", async () => {
      const { dataKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const wrappedKey = wrappedKeyBlob();
      const wrappedByKid = keyVersionAlias();

      const result = await dataKeyRepository.createUnlessExists({ userId: user.id, wrappedKey, wrappedByKid });

      expect(result.isNew).toBe(true);
      expect(result.dataKey).toMatchObject({ userId: user.id, wrappedKey, wrappedByKid });
      expect(await dataKeyRepository.findByUserId(user.id)).toMatchObject({ id: result.dataKey.id, wrappedKey });
    });

    it("returns the existing record when one already exists", async () => {
      const { dataKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const original = await dataKeyRepository.createUnlessExists({ userId: user.id, wrappedKey: "original-blob", wrappedByKid: "sdl-secrets.v1" });

      const result = await dataKeyRepository.createUnlessExists({ userId: user.id, wrappedKey: "replacement-blob", wrappedByKid: "sdl-secrets.v2" });

      expect(result.isNew).toBe(false);
      expect(result.dataKey).toMatchObject({ id: original.dataKey.id, wrappedKey: "original-blob", wrappedByKid: "sdl-secrets.v1" });
      expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
    });

    it("resolves a concurrent first write to a single record", async () => {
      const { dataKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const wrappedByKid = keyVersionAlias();

      const [first, second] = await Promise.all([
        dataKeyRepository.createUnlessExists({ userId: user.id, wrappedKey: "blob-from-first-writer", wrappedByKid }),
        dataKeyRepository.createUnlessExists({ userId: user.id, wrappedKey: "blob-from-second-writer", wrappedByKid })
      ]);

      expect(first.dataKey.id).toBe(second.dataKey.id);
      expect([first.isNew, second.isNew].filter(Boolean)).toHaveLength(1);
      expect(await dataKeyRepository.count({ userId: user.id })).toBe(1);
      expect(first.dataKey.wrappedKey).toBe(second.dataKey.wrappedKey);
      expect(["blob-from-first-writer", "blob-from-second-writer"]).toContain(first.dataKey.wrappedKey);
    });
  });

  describe("countWrappedUnder", () => {
    it("counts the data keys wrapped under a key version", async () => {
      const { dataKeyRepository, createTestUser } = setup();
      const keyName = faker.string.alphanumeric(10);
      const firstVersion = `${keyName}.v1`;
      const secondVersion = `${keyName}.v2`;
      const unusedVersion = `${keyName}.v3`;

      for (const wrappedByKid of [firstVersion, firstVersion, secondVersion]) {
        const user = await createTestUser();
        await dataKeyRepository.create({ userId: user.id, wrappedKey: wrappedKeyBlob(), wrappedByKid });
      }

      expect(await dataKeyRepository.countWrappedUnder(firstVersion)).toBe(2);
      expect(await dataKeyRepository.countWrappedUnder(secondVersion)).toBe(1);
      expect(await dataKeyRepository.countWrappedUnder(unusedVersion)).toBe(0);
    });
  });

  describe("user deletion", () => {
    it("deletes the data key when its user is deleted", async () => {
      const { dataKeyRepository, userRepository, createTestUser } = setup();
      const user = await createTestUser();
      const dataKey = await dataKeyRepository.create({ userId: user.id, wrappedKey: wrappedKeyBlob(), wrappedByKid: keyVersionAlias() });

      await userRepository.deleteById(user.id);

      expect(await dataKeyRepository.findById(dataKey.id)).toBeUndefined();
      expect(await dataKeyRepository.count({ userId: user.id })).toBe(0);
    });
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    await cleanup?.();
  });

  function wrappedKeyBlob() {
    return `wrapped-${faker.string.alphanumeric(64)}`;
  }

  function keyVersionAlias() {
    return `${faker.string.alphanumeric(8)}.v1`;
  }

  function setup() {
    const dataKeyRepository = container.resolve(DataKeyRepository);
    const userRepository = container.resolve(UserRepository);
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

    return { dataKeyRepository, userRepository, createTestUser };
  }
});
