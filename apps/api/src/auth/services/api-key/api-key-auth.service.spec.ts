import { container } from "tsyringe";

import { ApiKeyOutput, ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyAuthService } from "./api-key-auth.service";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

jest.mock("@src/auth/repositories/api-key/api-key.repository");

describe("ApiKeyAuthService", () => {
  let service: ApiKeyAuthService;
  let apiKeyGenerator: ApiKeyGeneratorService;
  let apiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    apiKeyGenerator = container.resolve(ApiKeyGeneratorService);

    apiKeyRepository = {
      findOneBy: jest.fn()
    } as Partial<jest.Mocked<ApiKeyRepository>> as jest.Mocked<ApiKeyRepository>;

    service = new ApiKeyAuthService(apiKeyGenerator, apiKeyRepository);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    container.clearInstances();
    jest.resetAllMocks();
  });

  describe("validateApiKeyFromHeader", () => {
    it("should return false for undefined key", async () => {
      const result = await service.validateApiKeyFromHeader(undefined);
      expect(result).toBe(undefined);
    });

    it("should return false for invalid format", async () => {
      const result = await service.validateApiKeyFromHeader("invalid-key");
      expect(result).toBe(undefined);
    });

    it("should return false for wrong prefix", async () => {
      const key = apiKeyGenerator.generateApiKey().replace("ac", "wrong");
      const result = await service.validateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false for wrong type", async () => {
      const key = apiKeyGenerator.generateApiKey().replace("sk", "wrong");
      const result = await service.validateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false for wrong environment", async () => {
      process.env.NODE_ENV = "production";
      const key = apiKeyGenerator.generateApiKey().replace("live", "test");
      const result = await service.validateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false when key not found in database", async () => {
      const key = apiKeyGenerator.generateApiKey();
      apiKeyRepository.findOneBy.mockResolvedValue(null);

      const result = await service.validateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
      expect(apiKeyRepository.findOneBy).toHaveBeenCalledWith({
        hashedKey: apiKeyGenerator.hashApiKey(key)
      });
    });

    it("should return false for expired key", async () => {
      const key = apiKeyGenerator.generateApiKey();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      apiKeyRepository.findOneBy.mockResolvedValue({
        id: "test-id",
        userId: "test-user",
        hashedKey: apiKeyGenerator.hashApiKey(key),
        keyFormat: apiKeyGenerator.obfuscateApiKey(key),
        name: "Test Key",
        description: null,
        expiresAt: pastDate.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const result = await service.validateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return true for valid active key and no expiration date", async () => {
      const key = apiKeyGenerator.generateApiKey();
      const mockedApiKey: ApiKeyOutput = {
        id: "test-id",
        userId: "test-user",
        hashedKey: apiKeyGenerator.hashApiKey(key),
        keyFormat: apiKeyGenerator.obfuscateApiKey(key),
        name: "Test Key",
        description: null,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      apiKeyRepository.findOneBy.mockResolvedValue(mockedApiKey);

      const result = await service.validateApiKeyFromHeader(key);
      expect(result).toBe(mockedApiKey);
    });

    it("should return true for valid key with future expiration", async () => {
      const key = apiKeyGenerator.generateApiKey();
      const hashedKey = apiKeyGenerator.hashApiKey(key);
      const futureDate = new Date();
      futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);

      const mockedApiKey: ApiKeyOutput = {
        id: "test-id",
        userId: "test-user",
        hashedKey,
        keyFormat: apiKeyGenerator.obfuscateApiKey(key),
        name: "Test Key",
        description: null,
        expiresAt: futureDate.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      apiKeyRepository.findOneBy.mockResolvedValue(mockedApiKey);

      const result = await service.validateApiKeyFromHeader(key);

      expect(apiKeyRepository.findOneBy).toHaveBeenCalledWith({ hashedKey });
      expect(result).toBe(mockedApiKey);
    });
  });
});
