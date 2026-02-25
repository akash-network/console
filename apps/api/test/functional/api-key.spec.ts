import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserAuthTokenService } from "@src/auth/services/user-auth-token/user-auth-token.service";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories/user/user.repository";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";

const OBFUSCATED_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{6}\*{3}[A-Za-z0-9]{6}$/;
const FULL_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{64}$/;

describe("API Keys", () => {
  const apiKeyRepository = container.resolve(ApiKeyRepository);
  const userRepository = container.resolve(UserRepository);
  const userAuthTokenService = container.resolve(UserAuthTokenService);

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /v1/api-keys", () => {
    it("returns 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/api-keys");
      expect(response.status).toBe(401);
    });

    it("returns empty array if no API keys found", async () => {
      const { token } = await setup();

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    });

    it("does not return other user's API keys", async () => {
      const { user: user1, token, createUser } = await setup();
      const { token: token2 } = await createUser();

      const key1 = ApiKeySeeder.create({
        userId: user1.id,
        name: "Test key 1"
      });
      await apiKeyRepository.create({
        ...key1,
        createdAt: new Date(key1.createdAt),
        updatedAt: new Date(key1.updatedAt),
        expiresAt: key1.expiresAt ? new Date(key1.expiresAt) : null,
        lastUsedAt: key1.lastUsedAt ? new Date(key1.lastUsedAt) : null
      });

      const [response, nonOwnerResponse] = await Promise.all([
        app.request("/v1/api-keys", {
          headers: { authorization: `Bearer ${token}` }
        }),
        app.request("/v1/api-keys", {
          headers: { authorization: `Bearer ${token2}` }
        })
      ]);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: expect.arrayContaining([expect.objectContaining({ id: key1.id })]) });
      expect(nonOwnerResponse.status).toBe(200);
      expect(await nonOwnerResponse.json()).toEqual({ data: [] });
    });

    it("returns list of API keys with obfuscated keys", async () => {
      const { token, user, apiKeyGenerator } = await setup();
      const apiKey = apiKeyGenerator.generateApiKey();
      const hashedKey = await apiKeyGenerator.hashApiKey(apiKey);
      const obfuscatedKey = apiKeyGenerator.obfuscateApiKey(apiKey);
      const apiKey2 = apiKeyGenerator.generateApiKey();
      const hashedKey2 = await apiKeyGenerator.hashApiKey(apiKey2);
      const obfuscatedKey2 = apiKeyGenerator.obfuscateApiKey(apiKey2);

      const key1 = ApiKeySeeder.create({
        userId: user.id,
        name: "Test key 1",
        hashedKey,
        keyFormat: obfuscatedKey
      });
      const key2 = ApiKeySeeder.create({
        userId: user.id,
        name: "Test key 2",
        hashedKey: hashedKey2,
        keyFormat: obfuscatedKey2
      });

      await Promise.all([
        apiKeyRepository.create({
          ...key1,
          createdAt: new Date(key1.createdAt),
          updatedAt: new Date(key1.updatedAt),
          expiresAt: key1.expiresAt ? new Date(key1.expiresAt) : null,
          lastUsedAt: key1.lastUsedAt ? new Date(key1.lastUsedAt) : null
        }),
        apiKeyRepository.create({
          ...key2,
          createdAt: new Date(key2.createdAt),
          updatedAt: new Date(key2.updatedAt),
          expiresAt: key2.expiresAt ? new Date(key2.expiresAt) : null,
          lastUsedAt: key2.lastUsedAt ? new Date(key2.lastUsedAt) : null
        })
      ]);

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as any;
      expect(result.data).toHaveLength(2);
      expect(result.data[0].keyFormat).toMatch(OBFUSCATED_API_KEY_PATTERN);
      expect(result.data[1].keyFormat).toMatch(OBFUSCATED_API_KEY_PATTERN);
    });
  });

  describe("GET /v1/api-keys/{id}", () => {
    it("returns 401 if user is not authenticated", async () => {
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/api-keys/${keyId}`);
      expect(response.status).toBe(401);
    });

    it("returns 404 if API key not found", async () => {
      const { token } = await setup();
      const keyId = faker.string.uuid();

      const response = await app.request(`/v1/api-keys/${keyId}`, {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "NotFoundError",
        message: "API key not found",
        code: "not_found",
        type: "client_error"
      });
    });

    it("returns API key details with obfuscated key", async () => {
      const { token, user, apiKeyGenerator } = await setup();
      const apiKey = apiKeyGenerator.generateApiKey();
      const hashedKey = await apiKeyGenerator.hashApiKey(apiKey);
      const obfuscatedKey = apiKeyGenerator.obfuscateApiKey(apiKey);

      const createdKey = await apiKeyRepository.create({
        userId: user.id,
        hashedKey,
        keyFormat: obfuscatedKey,
        name: "Test key"
      });

      const response = await app.request(`/v1/api-keys/${createdKey.id}`, {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as any;
      expect(result.data).toMatchObject({
        id: createdKey.id,
        name: "Test key",
        expiresAt: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
      expect(result.data.apiKey).not.toBe(hashedKey);
    });
  });

  describe("POST /v1/api-keys", () => {
    it("returns 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: {
            name: "Test key"
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("creates API key and returns full key once", async () => {
      const { token } = await setup();
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      const response = await app.request("/v1/api-keys", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            name: "Test key",
            expiresAt: futureDate.toISOString()
          }
        })
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as any;
      expect(result.data).toMatchObject({
        name: "Test key",
        expiresAt: futureDate.toISOString(),
        apiKey: expect.stringMatching(FULL_API_KEY_PATTERN)
      });

      const storedKey = await apiKeyRepository.findOneBy({ id: result.data.id });
      expect(storedKey).toBeDefined();
      expect(storedKey?.keyFormat).toMatch(OBFUSCATED_API_KEY_PATTERN);
      expect(storedKey?.hashedKey).not.toMatch(FULL_API_KEY_PATTERN);
    });

    it("rejects API key creation with past expiration date", async () => {
      const { token } = await setup();
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1);

      const response = await app.request("/v1/api-keys", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            name: "Test key",
            expiresAt: pastDate.toISOString()
          }
        })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toEqual({
        error: "BadRequestError",
        message: "Validation error",
        data: [
          {
            code: "custom",
            message: "Expiration date must be in the future",
            path: ["data", "expiresAt"]
          }
        ],
        code: "validation_error",
        type: "validation_error"
      });
    });

    it("allows API key creation for trial users", async () => {
      const { token } = await setup({ trial: true });

      const response = await app.request("/v1/api-keys", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            name: "Test key"
          }
        })
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as any;
      expect(result.data).toMatchObject({
        name: "Test key",
        apiKey: expect.stringMatching(FULL_API_KEY_PATTERN)
      });
    });
  });

  describe("PATCH /v1/api-keys/{id}", () => {
    it("returns 401 if user is not authenticated", async () => {
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: {
            name: "Updated key"
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("updates API key", async () => {
      const { token, user, apiKeyGenerator } = await setup();
      const apiKey = apiKeyGenerator.generateApiKey();
      const hashedKey = await apiKeyGenerator.hashApiKey(apiKey);
      const obfuscatedKey = apiKeyGenerator.obfuscateApiKey(apiKey);

      const createdKey = await apiKeyRepository.create({
        userId: user.id,
        hashedKey,
        keyFormat: obfuscatedKey,
        name: "Test key"
      });

      const response = await app.request(`/v1/api-keys/${createdKey.id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            name: "Updated key"
          }
        })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as any;
      expect(result.data).toMatchObject({
        id: createdKey.id,
        name: "Updated key"
      });

      const updatedApiKey = await apiKeyRepository.findOneBy({ id: createdKey.id });
      expect(updatedApiKey).toBeDefined();
      expect(updatedApiKey).toMatchObject({
        name: "Updated key"
      });
    });
  });

  describe("DELETE /v1/api-keys/{id}", () => {
    it("returns 401 if user is not authenticated", async () => {
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/api-keys/${keyId}`, {
        method: "DELETE"
      });
      expect(response.status).toBe(401);
    });

    it("deletes API key", async () => {
      const { token, user, apiKeyGenerator } = await setup();
      const apiKey = apiKeyGenerator.generateApiKey();
      const hashedKey = await apiKeyGenerator.hashApiKey(apiKey);
      const obfuscatedKey = apiKeyGenerator.obfuscateApiKey(apiKey);

      const createdKey = await apiKeyRepository.create({
        userId: user.id,
        hashedKey,
        keyFormat: obfuscatedKey,
        name: "Test key"
      });

      const response = await app.request(`/v1/api-keys/${createdKey.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");

      const deletedApiKey = await apiKeyRepository.findOneBy({ id: createdKey.id });
      expect(deletedApiKey).toBeUndefined();
    });
  });

  async function setup(input: { trial?: boolean } = {}) {
    const userToToken: Record<string, string> = {};
    const createUser = async () => {
      const user = await userRepository.create({ userId: faker.string.uuid() });
      const token = faker.string.alphanumeric(40);
      userToToken[token] = user.userId!;
      return { user, token };
    };

    const originalFindById = userRepository.findByUserId;
    vi.spyOn(userRepository, "findByUserId").mockImplementation(async id => {
      const user = await originalFindById.call(userRepository, id);
      if (!user) return;

      return {
        ...user,
        trial: input.trial ?? false,
        userWallets: { isTrialing: input.trial ?? false }
      };
    });

    vi.spyOn(userAuthTokenService, "getValidUserId").mockImplementation(async token => {
      return userToToken[token.replace(/^Bearer +/i, "")];
    });

    const config = mock<CoreConfigService>({
      get: vi.fn().mockReturnValue("test")
    });
    const apiKeyGenerator = new ApiKeyGeneratorService(config);
    const { user, token } = await createUser();

    return { user, token, createUser, apiKeyGenerator };
  }
});
