import { Unauthorized } from "http-errors";
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
    config = stub<CoreConfigService>({ get: jest.fn() });
    config.get.mockReturnValue("test");
    apiKeyGenerator = new ApiKeyGeneratorService(config);
    apiKeyRepository = stub<ApiKeyRepository>({ findOneBy: jest.fn() });

    service = new ApiKeyAuthService(apiKeyGenerator, apiKeyRepository, config);
  });

  afterEach(() => {
    container.clearInstances();
    jest.resetAllMocks();
  });

  describe("validateApiKeyFromHeader", () => {
    it("should throw for undefined key", async () => {
      await expect(service.getAndValidateApiKeyFromHeader(undefined)).rejects.toThrow(new Unauthorized("Invalid API key"));
    });

    it("should throw for invalid format", async () => {
      await expect(service.getAndValidateApiKeyFromHeader("invalid-key")).rejects.toThrow(new Unauthorized("Invalid API key format"));
    });

    it("should throw for wrong prefix", async () => {
      const key = apiKeyGenerator.generateApiKey().replace("ac", "wrong");
      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow(new Unauthorized("Invalid API key format"));
    });

    it("should throw for wrong type", async () => {
      const key = apiKeyGenerator.generateApiKey().replace("sk", "wrong");
      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow(new Unauthorized("Invalid API key format"));
    });

    it("should throw for wrong environment", async () => {
      config.get.mockReturnValue("live");
      const testApiKeyGeneratorService = new ApiKeyGeneratorService(config);
      const testApiKeyAuthService = new ApiKeyAuthService(testApiKeyGeneratorService, apiKeyRepository, config);
      const key = testApiKeyGeneratorService.generateApiKey().replace("live", "test");
      await expect(testApiKeyAuthService.getAndValidateApiKeyFromHeader(key)).rejects.toThrow(new Unauthorized("Invalid API key format"));
    });

    it("should throw when key not found in database", async () => {
      const key = apiKeyGenerator.generateApiKey();
      apiKeyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow(new Unauthorized("API key not found"));
    });

    it("should throw for expired key", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const apiKey = apiKeyGenerator.generateApiKey();
      const data = ApiKeySeeder.create({
        expiresAt: pastDate.toISOString(),
        hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
        keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
      });

      apiKeyRepository.findOneBy.mockResolvedValue(data);

      await expect(service.getAndValidateApiKeyFromHeader(apiKey)).rejects.toThrow(new Unauthorized("API key has expired"));
    });

    it("should return API key data for valid key with future expiration", async () => {
      const futureDate = new Date();
      futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);

      const apiKey = apiKeyGenerator.generateApiKey();
      const data = ApiKeySeeder.create({
        expiresAt: futureDate.toISOString(),
        hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
        keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
      });

      apiKeyRepository.findOneBy.mockResolvedValue(data);

      const result = await service.getAndValidateApiKeyFromHeader(apiKey);
      expect(result).toBe(data);
    });

    it("should return API key data for valid key with no expiration", async () => {
      const apiKey = apiKeyGenerator.generateApiKey();
      const data = ApiKeySeeder.create({
        hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
        keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
      });
      apiKeyRepository.findOneBy.mockResolvedValue(data);

      const result = await service.getAndValidateApiKeyFromHeader(apiKey);
      expect(result).toBe(data);
    });
  });
});
