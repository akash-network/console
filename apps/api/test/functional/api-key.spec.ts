import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";
import { DbTestingService } from "@test/services/db-testing.service";
import { stub } from "@test/services/stub";
import { WalletTestingService } from "@test/services/wallet-testing.service";

const OBFUSCATED_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{6}\*{3}[A-Za-z0-9]{6}$/;
const FULL_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{64}$/;

jest.setTimeout(20000);

describe("API Keys", () => {
  const dbService = container.resolve(DbTestingService);
  const walletService = new WalletTestingService(app);
  const apiKeyRepository = container.resolve(ApiKeyRepository);
  let config: jest.Mocked<CoreConfigService>;
  let apiKeyGenerator: ApiKeyGeneratorService;

  beforeEach(async () => {
    config = stub<CoreConfigService>({ get: jest.fn() });
    config.get.mockReturnValue("test");
    apiKeyGenerator = new ApiKeyGeneratorService(config);

    await dbService.cleanAll();
  });

  describe("GET /v1/api-keys", () => {
    it("should return 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/api-keys");
      expect(response.status).toBe(401);
    });

    it("should return empty array if no API keys found", async () => {
      const { token } = await walletService.createUserAndWallet();

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    });

    it("should not return other user's API keys", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const key1 = ApiKeySeeder.create({
        userId: user1.id,
        name: "Test key 1"
      });
      await apiKeyRepository.create({
        ...key1,
        createdAt: new Date(key1.createdAt),
        updatedAt: new Date(key1.updatedAt),
        expiresAt: key1.expiresAt ? new Date(key1.expiresAt) : null
      });

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token2}` }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    });

    it("should return list of API keys with obfuscated keys", async () => {
      const { token, user } = await walletService.createUserAndWallet();
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
          expiresAt: key1.expiresAt ? new Date(key1.expiresAt) : null
        }),
        apiKeyRepository.create({
          ...key2,
          createdAt: new Date(key2.createdAt),
          updatedAt: new Date(key2.updatedAt),
          expiresAt: key2.expiresAt ? new Date(key2.expiresAt) : null
        })
      ]);

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toHaveLength(2);
      expect(result.data[0].keyFormat).toMatch(OBFUSCATED_API_KEY_PATTERN);
      expect(result.data[1].keyFormat).toMatch(OBFUSCATED_API_KEY_PATTERN);
    });
  });

  describe("GET /v1/api-keys/{id}", () => {
    it("should return 401 if user is not authenticated", async () => {
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/api-keys/${keyId}`);
      expect(response.status).toBe(401);
    });

    it("should return 404 if API key not found", async () => {
      const { token } = await walletService.createUserAndWallet();
      const keyId = faker.string.uuid();

      const response = await app.request(`/v1/api-keys/${keyId}`, {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "NotFoundError",
        message: "API key not found"
      });
    });

    it("should return API key details with obfuscated key", async () => {
      const { token, user } = await walletService.createUserAndWallet();
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
      const result = await response.json();
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
    it("should return 401 if user is not authenticated", async () => {
      const response = await app.request("/v1/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          data: {
            name: "Test key",
            description: "Test key"
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("should create API key and return full key once", async () => {
      const { token } = await walletService.createUserAndWallet();
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
            description: "Test description",
            expiresAt: futureDate.toISOString()
          }
        })
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.data).toMatchObject({
        name: "Test key",
        description: "Test description",
        expiresAt: futureDate.toISOString(),
        apiKey: expect.stringMatching(FULL_API_KEY_PATTERN)
      });

      const storedKey = await apiKeyRepository.findOneBy({ id: result.data.id });
      expect(storedKey).toBeDefined();
      expect(storedKey.keyFormat).toMatch(OBFUSCATED_API_KEY_PATTERN);
      expect(storedKey.hashedKey).not.toMatch(FULL_API_KEY_PATTERN);
    });

    it("should reject API key creation with past expiration date", async () => {
      const { token } = await walletService.createUserAndWallet();
      const pastDate = new Date();
      pastDate.setFullYear(pastDate.getFullYear() - 1); // 1 year ago

      const response = await app.request("/v1/api-keys", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            name: "Test key",
            description: "Test key",
            expiresAt: pastDate.toISOString()
          }
        })
      });

      expect(response.status).toBe(400);
      const result = await response.json();
      expect(result).toEqual({
        error: "BadRequestError",
        data: [
          {
            code: "custom",
            message: "Expiration date must be in the future",
            path: ["data", "expiresAt"]
          }
        ]
      });
    });
  });

  describe("PATCH /v1/api-keys/{id}", () => {
    it("should return 401 if user is not authenticated", async () => {
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

    it("should update API key", async () => {
      const { token, user } = await walletService.createUserAndWallet();
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
            description: "Updated key"
          }
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toMatchObject({
        id: createdKey.id,
        name: "Test key",
        description: "Updated key"
      });

      const updatedApiKey = await apiKeyRepository.findOneBy({ id: createdKey.id });
      expect(updatedApiKey).toBeDefined();
      expect(updatedApiKey).toMatchObject({
        name: "Test key",
        description: "Updated key"
      });
    });
  });

  describe("DELETE /v1/api-keys/{id}", () => {
    it("should return 401 if user is not authenticated", async () => {
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/api-keys/${keyId}`, {
        method: "DELETE"
      });
      expect(response.status).toBe(401);
    });

    it("should delete API key", async () => {
      const { token, user } = await walletService.createUserAndWallet();
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
});
