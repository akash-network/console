import { container } from "tsyringe";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ApiKeyAuthService } from "./api-key-auth.service";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";
import { stub } from "@test/services/stub";

describe("ApiKeyAuthService", () => {
  let service: ApiKeyAuthService;
  let apiKeyGenerator: ApiKeyGeneratorService;
  let apiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let config: jest.Mocked<CoreConfigService>;

  beforeEach(() => {
    apiKeyGenerator = container.resolve(ApiKeyGeneratorService);
    config = stub<CoreConfigService>({ get: jest.fn() });
    apiKeyRepository = stub<ApiKeyRepository>({ findOneBy: jest.fn() });

    config.get.mockReturnValue("test");

    service = new ApiKeyAuthService(apiKeyGenerator, apiKeyRepository, config);
  });

  afterEach(() => {
    container.clearInstances();
    jest.resetAllMocks();
  });

  describe("validateApiKeyFromHeader", () => {
    it("should return false for undefined key", async () => {
      const result = await service.getAndValidateApiKeyFromHeader(undefined);
      expect(result).toBe(undefined);
    });

    it("should return false for invalid format", async () => {
      const result = await service.getAndValidateApiKeyFromHeader("invalid-key");
      expect(result).toBe(undefined);
    });

    it("should return false for wrong prefix", async () => {
      const key = apiKeyGenerator.generateApiKey().replace("ac", "wrong");
      const result = await service.getAndValidateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false for wrong type", async () => {
      const key = apiKeyGenerator.generateApiKey().replace("sk", "wrong");
      const result = await service.getAndValidateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false for wrong environment", async () => {
      config.get.mockReturnValue("live");
      const key = apiKeyGenerator.generateApiKey().replace("live", "test");
      const result = await service.getAndValidateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false when key not found in database", async () => {
      const key = apiKeyGenerator.generateApiKey();
      apiKeyRepository.findOneBy.mockResolvedValue(null);

      const result = await service.getAndValidateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return false for expired key", async () => {
      const key = apiKeyGenerator.generateApiKey();
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockApiKey = ApiKeySeeder.create({
        expiresAt: pastDate.toISOString(),
        hashedKey: apiKeyGenerator.hashApiKey(key)
      });

      apiKeyRepository.findOneBy.mockResolvedValue(mockApiKey);

      const result = await service.getAndValidateApiKeyFromHeader(key);
      expect(result).toBe(undefined);
    });

    it("should return true for valid active key and no expiration date", async () => {
      const { apiKey, data } = ApiKeySeeder.createWithKey();

      apiKeyRepository.findOneBy.mockResolvedValue(data);

      const result = await service.getAndValidateApiKeyFromHeader(apiKey);
      expect(result).toBe(data);
    });

    it("should return true for valid key with future expiration", async () => {
      const { apiKey, data } = ApiKeySeeder.createWithKey({
        expiresAt: new Date(Date.now() + 86400000).toISOString() // tomorrow
      });

      apiKeyRepository.findOneBy.mockResolvedValue(data);

      const result = await service.getAndValidateApiKeyFromHeader(apiKey);
      expect(result).toBe(data);
    });
  });
});
