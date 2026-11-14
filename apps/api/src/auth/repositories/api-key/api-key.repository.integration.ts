import { faker } from "@faker-js/faker";
import { hash } from "bcryptjs";
import { sql } from "drizzle-orm";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB } from "@src/core";
import { getPostgresError } from "@src/core/repositories/base.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { ApiKeyRepository } from "./api-key.repository";

import { seedPersonalOrganizationIdOf } from "@test/seeders/db/user-with-wallet.seeder";

describe(ApiKeyRepository.name, () => {
  describe("findBcryptKeysByKeyFormat", () => {
    it("returns keys with bcrypt hashes matching the key format", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const keyFormat = `ac.sk.test.abc123***def456`;
      const bcryptHash = await hash("some-api-key", 10);

      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: bcryptHash,
        keyFormat
      });

      const result = await apiKeyRepository.findBcryptKeysByKeyFormat(keyFormat);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(apiKey.id);
    });

    it("excludes keys with sha256 hashes", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const keyFormat = `ac.sk.test.abc123***def456`;
      const sha256Hash = faker.string.hexadecimal({ length: 64, prefix: "" });

      await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: sha256Hash,
        keyFormat
      });

      const result = await apiKeyRepository.findBcryptKeysByKeyFormat(keyFormat);

      expect(result).toHaveLength(0);
    });

    it("excludes keys with different key format", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const bcryptHash = await hash("some-api-key", 10);

      await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: bcryptHash,
        keyFormat: `ac.sk.test.aaaaaa***bbbbbb`
      });

      const result = await apiKeyRepository.findBcryptKeysByKeyFormat(`ac.sk.test.cccccc***dddddd`);

      expect(result).toHaveLength(0);
    });

    it("returns empty array when no keys exist", async () => {
      const { apiKeyRepository } = setup();

      const result = await apiKeyRepository.findBcryptKeysByKeyFormat(`ac.sk.test.abc123***def456`);

      expect(result).toHaveLength(0);
    });
  });

  describe("updateHash", () => {
    it("updates the hashed key when values differ", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const bcryptHash = await hash("some-api-key", 10);
      const newHash = faker.string.hexadecimal({ length: 64, prefix: "" });

      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: bcryptHash,
        keyFormat: `ac.sk.test.abc123***def456`
      });

      await apiKeyRepository.updateHash(apiKey.id, newHash);

      const updated = await apiKeyRepository.findById(apiKey.id);
      expect(updated?.hashedKey).toBe(newHash);
    });

    it("does not update when hashed key is the same", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const existingHash = faker.string.hexadecimal({ length: 64, prefix: "" });

      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: existingHash,
        keyFormat: `ac.sk.test.abc123***def456`
      });

      await apiKeyRepository.updateHash(apiKey.id, existingHash);

      const result = await apiKeyRepository.findById(apiKey.id);
      expect(result?.hashedKey).toBe(existingHash);
    });
  });

  describe("markAsUsed", () => {
    it("updates lastUsedAt when last used longer ago than throttle", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();
      const oldDate = new Date();
      oldDate.setHours(oldDate.getHours() - 1);

      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: faker.string.hexadecimal({ length: 64, prefix: "" }),
        keyFormat: `ac.sk.test.abc123***def456`,
        lastUsedAt: oldDate
      });

      await apiKeyRepository.markAsUsed(apiKey.id, 60);

      const updated = await apiKeyRepository.findById(apiKey.id);
      expect(updated?.lastUsedAt).not.toBe(apiKey.lastUsedAt);
    });

    it("does not update lastUsedAt when recently used", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();

      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: faker.string.hexadecimal({ length: 64, prefix: "" }),
        keyFormat: `ac.sk.test.abc123***def456`,
        lastUsedAt: new Date()
      });

      const before = await apiKeyRepository.findById(apiKey.id);

      await apiKeyRepository.markAsUsed(apiKey.id, 3600);

      const after = await apiKeyRepository.findById(apiKey.id);
      expect(after?.lastUsedAt).toBe(before?.lastUsedAt);
    });

    it("updates lastUsedAt when it is null", async () => {
      const { apiKeyRepository, createTestUser } = setup();
      const user = await createTestUser();

      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        organizationId: await seedPersonalOrganizationIdOf(user.id),
        name: faker.company.name(),
        hashedKey: faker.string.hexadecimal({ length: 64, prefix: "" }),
        keyFormat: `ac.sk.test.abc123***def456`
      });

      await apiKeyRepository.markAsUsed(apiKey.id, 60);

      const updated = await apiKeyRepository.findById(apiKey.id);
      expect(updated?.lastUsedAt).not.toBeNull();
    });
  });

  describe("organization constraints", () => {
    it("refuses a key that belongs to no organization", async () => {
      const { createTestUser, insertApiKey } = setup();
      const user = await createTestUser();

      const error = await insertApiKey({ userId: user.id, organizationId: null, projectId: null }).catch((caught: unknown) => caught);

      expect(getPostgresError(error)).toMatchObject({ code: "23502", column_name: "organization_id" });
    });

    it("refuses a key that belongs to an organization that does not exist", async () => {
      const { createTestUser, insertApiKey } = setup();
      const user = await createTestUser();

      const error = await insertApiKey({ userId: user.id, organizationId: faker.string.uuid(), projectId: null }).catch((caught: unknown) => caught);

      expect(getPostgresError(error)?.constraint_name).toBe("api_keys_organization_id_organizations_id_fk");
    });

    it("refuses a key bound to a project its organization does not have", async () => {
      const { createTestUser, insertApiKey } = setup();
      const user = await createTestUser();
      const organizationId = await seedPersonalOrganizationIdOf(user.id);

      const error = await insertApiKey({ userId: user.id, organizationId, projectId: faker.string.uuid() }).catch((caught: unknown) => caught);

      expect(getPostgresError(error)?.constraint_name).toBe("api_keys_organization_id_project_id_fk");
    });
  });

  let cleanup: () => Promise<void>;
  afterEach(async () => {
    await cleanup?.();
  });

  function setup() {
    const apiKeyRepository = container.resolve(ApiKeyRepository);
    const userRepository = container.resolve(UserRepository);
    const createdApiKeyIds: string[] = [];
    const createdUserIds: string[] = [];

    const originalCreate = apiKeyRepository.create.bind(apiKeyRepository);
    apiKeyRepository.create = async (...args: Parameters<typeof originalCreate>) => {
      const result = await originalCreate(...args);
      createdApiKeyIds.push(result.id);
      return result;
    };

    cleanup = async () => {
      if (createdApiKeyIds.length > 0) {
        await apiKeyRepository.deleteById(createdApiKeyIds);
      }
      if (createdUserIds.length > 0) {
        await userRepository.deleteById(createdUserIds);
      }
    };

    async function createTestUser() {
      const user = await userRepository.create({
        id: faker.string.uuid(),
        userId: faker.string.uuid(),
        username: `testuser_${Date.now()}_${faker.string.alphanumeric(6)}`,
        email: faker.internet.email(),
        emailVerified: faker.datatype.boolean(),
        subscribedToNewsletter: false
      });
      createdUserIds.push(user.id);
      return user;
    }

    async function insertApiKey({ userId, organizationId, projectId }: { userId: string; organizationId: string | null; projectId: string | null }) {
      await container.resolve<ApiPgDatabase>(POSTGRES_DB).execute(sql`
        insert into api_keys (user_id, organization_id, project_id, hashed_key, key_format, name)
        values (${userId}, ${organizationId}, ${projectId}, ${faker.string.alphanumeric(64)}, ${faker.string.alphanumeric(12)}, ${faker.word.noun()})
      `);
    }

    return { apiKeyRepository, createTestUser, insertApiKey };
  }
});
