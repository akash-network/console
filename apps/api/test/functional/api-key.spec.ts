import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";

import { DbTestingService } from "@test/services/db-testing.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(20000);

describe("API Keys", () => {
  const dbService = container.resolve(DbTestingService);
  const walletService = new WalletTestingService(app);
  const apiKeyRepository = container.resolve(ApiKeyRepository);

  beforeEach(async () => {
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

      await apiKeyRepository.create({
        userId: user1.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        name: "Test key",
        description: "Test key"
      });

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token2}` }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ data: [] });
    });

    it("should return list of API keys", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        name: "Test key"
      });
      const apiKey2 = await apiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        name: "Test key 2"
      });

      const response = await app.request("/v1/api-keys", {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        id: apiKey.id,
        name: "Test key"
      });
      expect(result.data[1]).toMatchObject({
        id: apiKey2.id,
        name: "Test key 2"
      });
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

    it("should return API key details", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        name: "Test key"
      });

      const response = await app.request(`/v1/api-keys/${apiKey.id}`, {
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: apiKey.id,
          name: "Test key",
          expiresAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
          userId: user.id,
          apiKey: apiKey.apiKey,
          description: null
        }
      });
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

    it("should create API key", async () => {
      const { token, user } = await walletService.createUserAndWallet();

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
            expiresAt: "2024-12-31T23:59:59Z"
          }
        })
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.data).toMatchObject({
        name: "Test key",
        description: "Test key",
        expiresAt: "2024-12-31T23:59:59.000Z"
      });

      const apiKey = await apiKeyRepository.findOneBy({ id: result.data.id });
      expect(apiKey).toBeDefined();
      expect(apiKey).toMatchObject({
        userId: user.id,
        name: "Test key",
        description: "Test key"
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
      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        name: "Test key"
      });

      const response = await app.request(`/v1/api-keys/${apiKey.id}`, {
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
        id: apiKey.id,
        name: "Test key",
        description: "Updated key"
      });

      const updatedApiKey = await apiKeyRepository.findOneBy({ id: apiKey.id });
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
      const apiKey = await apiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        name: "Test key"
      });

      const response = await app.request(`/v1/api-keys/${apiKey.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` }
      });

      expect(response.status).toBe(204);
      expect(await response.text()).toBe("");

      const deletedApiKey = await apiKeyRepository.findOneBy({ id: apiKey.id });
      expect(deletedApiKey).toBeUndefined();
    });
  });
});
