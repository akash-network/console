import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/app";
import { UserApiKeyRepository } from "@src/user/repositories/user-api-key/user-api-key.repository";

import { DbTestingService } from "@test/services/db-testing.service";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(20000);

describe("User API Keys", () => {
  const dbService = container.resolve(DbTestingService);
  const walletService = new WalletTestingService(app);
  const userApiKeyRepository = container.resolve(UserApiKeyRepository);

  beforeEach(async () => {
    await dbService.cleanAll();
  });

  describe("GET /v1/users/{userId}/api-keys", () => {
    it("should return 401 if user is not authenticated", async () => {
      const userId = faker.string.uuid();
      const response = await app.request(`/v1/users/${userId}/api-keys`);
      expect(response.status).toBe(401);
    });

    it("should return empty array if no API keys found", async () => {
      const { token, user } = await walletService.createUserAndWallet();

      const response = await app.request(`/v1/users/${user.id}/api-keys`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    });

    it("should return 404 when accessing other user's API keys", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      await userApiKeyRepository.create({
        userId: user1.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user1.id}/api-keys`, {
        headers: {
          authorization: `Bearer ${token2}`
        }
      });

      expect(response.status).toBe(404);
    });

    it("should return list of API keys", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const apiKey = await userApiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user.id}/api-keys`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: apiKey.id,
        description: "Test key",
        isActive: true
      });
    });
  });

  describe("GET /v1/users/{userId}/api-keys/{id}", () => {
    it("should return 401 if user is not authenticated", async () => {
      const userId = faker.string.uuid();
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/users/${userId}/api-keys/${keyId}`);
      expect(response.status).toBe(401);
    });

    it("should return 404 if API key not found", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const keyId = faker.string.uuid();

      const response = await app.request(`/v1/users/${user.id}/api-keys/${keyId}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: "NotFoundError",
        message: "API key not found"
      });
    });

    it("should return 404 when accessing other user's API key", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const apiKey = await userApiKeyRepository.create({
        userId: user1.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user1.id}/api-keys/${apiKey.id}`, {
        headers: {
          authorization: `Bearer ${token2}`
        }
      });

      expect(response.status).toBe(404);
    });

    it("should return API key details", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const apiKey = await userApiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user.id}/api-keys/${apiKey.id}`, {
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        data: {
          id: apiKey.id,
          description: "Test key",
          isActive: true,
          expiresAt: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String)
        }
      });
    });
  });

  describe("POST /v1/users/{userId}/api-keys", () => {
    it("should return 401 if user is not authenticated", async () => {
      const userId = faker.string.uuid();
      const response = await app.request(`/v1/users/${userId}/api-keys`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            description: "Test key"
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("should return 403 when creating API key for another user", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const response = await app.request(`/v1/users/${user1.id}/api-keys`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token2}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            description: "Test key"
          }
        })
      });

      expect(response.status).toBe(403);
    });

    it("should create API key", async () => {
      const { token, user } = await walletService.createUserAndWallet();

      const response = await app.request(`/v1/users/${user.id}/api-keys`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            description: "Test key",
            expiresAt: "2024-12-31T23:59:59Z"
          }
        })
      });

      expect(response.status).toBe(201);
      const result = await response.json();
      expect(result.data).toMatchObject({
        description: "Test key",
        isActive: true,
        expiresAt: "2024-12-31T23:59:59.000Z"
      });

      const apiKey = await userApiKeyRepository.findOneBy({ id: result.data.id });
      expect(apiKey).toBeDefined();
      expect(apiKey).toMatchObject({
        userId: user.id,
        description: "Test key",
        isActive: true
      });
    });
  });

  describe("PATCH /v1/users/{userId}/api-keys/{id}", () => {
    it("should return 401 if user is not authenticated", async () => {
      const userId = faker.string.uuid();
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/users/${userId}/api-keys/${keyId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            isActive: false
          }
        })
      });

      expect(response.status).toBe(401);
    });

    it("should return 404 if API key not found", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const keyId = faker.string.uuid();

      const response = await app.request(`/v1/users/${user.id}/api-keys/${keyId}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            isActive: false
          }
        })
      });

      expect(response.status).toBe(404);
    });

    it("should return 404 when updating other user's API key", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const apiKey = await userApiKeyRepository.create({
        userId: user1.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user1.id}/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token2}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            isActive: false
          }
        })
      });

      expect(response.status).toBe(404);
    });

    it("should update API key", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const apiKey = await userApiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user.id}/api-keys/${apiKey.id}`, {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          data: {
            description: "Updated key",
            isActive: false
          }
        })
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toMatchObject({
        id: apiKey.id,
        description: "Updated key",
        isActive: false
      });

      const updatedApiKey = await userApiKeyRepository.findOneBy({ id: apiKey.id });
      expect(updatedApiKey).toBeDefined();
      expect(updatedApiKey).toMatchObject({
        description: "Updated key",
        isActive: false
      });
    });
  });

  describe("DELETE /v1/users/{userId}/api-keys/{id}", () => {
    it("should return 401 if user is not authenticated", async () => {
      const userId = faker.string.uuid();
      const keyId = faker.string.uuid();
      const response = await app.request(`/v1/users/${userId}/api-keys/${keyId}`, {
        method: "DELETE"
      });
      expect(response.status).toBe(401);
    });

    it("should return 404 if API key not found", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const keyId = faker.string.uuid();

      const response = await app.request(`/v1/users/${user.id}/api-keys/${keyId}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(404);
    });

    it("should return 404 when deleting other user's API key", async () => {
      const [{ user: user1 }, { token: token2 }] = await Promise.all([walletService.createUserAndWallet(), walletService.createUserAndWallet()]);

      const apiKey = await userApiKeyRepository.create({
        userId: user1.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user1.id}/api-keys/${apiKey.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token2}`
        }
      });

      expect(response.status).toBe(404);
    });

    it("should delete API key", async () => {
      const { token, user } = await walletService.createUserAndWallet();
      const apiKey = await userApiKeyRepository.create({
        userId: user.id,
        apiKey: `AKT_${faker.string.uuid()}`,
        description: "Test key"
      });

      const response = await app.request(`/v1/users/${user.id}/api-keys/${apiKey.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.status).toBe(200);
      const result = await response.json();
      expect(result.data).toMatchObject({
        id: apiKey.id,
        description: "Test key"
      });

      const deletedApiKey = await userApiKeyRepository.findOneBy({ id: apiKey.id });
      expect(deletedApiKey).toBeUndefined();
    });
  });
});
