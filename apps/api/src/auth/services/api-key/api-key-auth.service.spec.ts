import { mock, type MockProxy } from "vitest-mock-extended";

import type { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ApiKeyAuthService } from "./api-key-auth.service";
import { ApiKeyGeneratorService } from "./api-key-generator.service";

import { ApiKeySeeder } from "@test/seeders/api-key.seeder";

describe("ApiKeyAuthService", () => {
  describe("getAndValidateApiKeyFromHeader", () => {
    it("should throw for undefined key", async () => {
      const { service } = setup();
      await expect(service.getAndValidateApiKeyFromHeader(undefined)).rejects.toThrow("Invalid API key");
    });

    it("should throw for invalid format", async () => {
      const { service } = setup();
      await expect(service.getAndValidateApiKeyFromHeader("invalid-key")).rejects.toThrow("Invalid API key format");
    });

    it("should throw for wrong prefix", async () => {
      const { service, apiKeyGenerator } = setup();
      const key = apiKeyGenerator.generateApiKey().replace("ac", "wrong");
      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow("Invalid API key format");
    });

    it("should throw for wrong type", async () => {
      const { service, apiKeyGenerator } = setup();
      const key = apiKeyGenerator.generateApiKey().replace("sk", "wrong");
      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow("Invalid API key format");
    });

    it("should throw for wrong environment", async () => {
      const { service, apiKeyGenerator } = setup({ env: "live" });
      const key = apiKeyGenerator.generateApiKey().replace("live", "test");
      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow("Invalid API key format");
    });

    it("should throw when key not found in database", async () => {
      const { service, apiKeyGenerator, apiKeyRepository } = setup();
      const key = apiKeyGenerator.generateApiKey();
      apiKeyRepository.findOneBy.mockResolvedValue(undefined);
      apiKeyRepository.findBcryptKeysByKeyFormat.mockResolvedValue([]);

      await expect(service.getAndValidateApiKeyFromHeader(key)).rejects.toThrow("API key not found");
    });

    describe("sha256 lookup", () => {
      it("should return key found by sha256 hash", async () => {
        const { service, apiKeyGenerator, apiKeyRepository } = setup();
        const apiKey = apiKeyGenerator.generateApiKey();
        const data = ApiKeySeeder.create({
          hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
          keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
        });

        apiKeyRepository.findOneBy.mockResolvedValue(data);

        const result = await service.getAndValidateApiKeyFromHeader(apiKey);
        expect(result).toBe(data);
        expect(apiKeyRepository.findBcryptKeysByKeyFormat).not.toHaveBeenCalled();
      });

      it("should throw for expired key found by sha256", async () => {
        const { service, apiKeyGenerator, apiKeyRepository } = setup();
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const apiKey = apiKeyGenerator.generateApiKey();
        const data = ApiKeySeeder.create({
          expiresAt: pastDate.toISOString(),
          hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
          keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
        });

        apiKeyRepository.findOneBy.mockResolvedValue(data);

        await expect(service.getAndValidateApiKeyFromHeader(apiKey)).rejects.toThrow("API key has expired");
      });

      it("should return key with future expiration", async () => {
        const { service, apiKeyGenerator, apiKeyRepository } = setup();
        const futureDate = new Date();
        futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);

        const apiKey = apiKeyGenerator.generateApiKey();
        const data = ApiKeySeeder.create({
          expiresAt: futureDate.toISOString(),
          hashedKey: apiKeyGenerator.hashApiKeySha256(apiKey),
          keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
        });

        apiKeyRepository.findOneBy.mockResolvedValue(data);

        const result = await service.getAndValidateApiKeyFromHeader(apiKey);
        expect(result).toBe(data);
      });
    });

    describe("bcrypt fallback", () => {
      it("should fallback to bcrypt when sha256 not found", async () => {
        const { service, apiKeyGenerator, apiKeyRepository } = setup();
        const apiKey = apiKeyGenerator.generateApiKey();
        const data = ApiKeySeeder.create({
          hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
          keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
        });

        apiKeyRepository.findOneBy.mockResolvedValue(undefined);
        apiKeyRepository.findBcryptKeysByKeyFormat.mockResolvedValue([data]);

        const result = await service.getAndValidateApiKeyFromHeader(apiKey);
        expect(result).toBe(data);
      });

      it("should update hashedKey to sha256 after bcrypt match", async () => {
        const { service, apiKeyGenerator, apiKeyRepository } = setup();
        const apiKey = apiKeyGenerator.generateApiKey();
        const data = ApiKeySeeder.create({
          hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
          keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
        });

        apiKeyRepository.findOneBy.mockResolvedValue(undefined);
        apiKeyRepository.findBcryptKeysByKeyFormat.mockResolvedValue([data]);

        await service.getAndValidateApiKeyFromHeader(apiKey);

        const expectedSha256 = apiKeyGenerator.hashApiKeySha256(apiKey);
        expect(apiKeyRepository.updateHash).toHaveBeenCalledWith(data.id, expectedSha256);
      });

      it("should throw for expired key found by bcrypt", async () => {
        const { service, apiKeyGenerator, apiKeyRepository } = setup();
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 1);

        const apiKey = apiKeyGenerator.generateApiKey();
        const data = ApiKeySeeder.create({
          expiresAt: pastDate.toISOString(),
          hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
          keyFormat: apiKeyGenerator.obfuscateApiKey(apiKey)
        });

        apiKeyRepository.findOneBy.mockResolvedValue(undefined);
        apiKeyRepository.findBcryptKeysByKeyFormat.mockResolvedValue([data]);

        await expect(service.getAndValidateApiKeyFromHeader(apiKey)).rejects.toThrow("API key has expired");
      });
    });
  });

  function setup(input: { env?: string } = {}) {
    const config = mock<CoreConfigService>();
    config.get.mockReturnValue(input.env ?? "test");

    const apiKeyGenerator = new ApiKeyGeneratorService(config);
    const apiKeyRepository: MockProxy<ApiKeyRepository> = mock<ApiKeyRepository>();
    const service = new ApiKeyAuthService(apiKeyGenerator, apiKeyRepository, config);

    return { service, apiKeyGenerator, apiKeyRepository, config };
  }
});
