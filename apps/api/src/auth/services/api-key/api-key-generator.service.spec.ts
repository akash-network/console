import { container } from "tsyringe";

import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";

import { stub } from "@test/services/stub";

const FULL_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{64}$/;
const OBFUSCATED_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{6}\*{3}[A-Za-z0-9]{6}$/;
const HASHED_API_KEY_PATTERN = /^\$2[abxy]\$\d{2}\$[A-Za-z0-9./]{53}$/;

describe("ApiKeyGeneratorService", () => {
  let service: ApiKeyGeneratorService;
  let originalEnv: string | undefined;
  let config: jest.Mocked<CoreConfigService>;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    config = stub<CoreConfigService>({ get: jest.fn() });
    config.get.mockReturnValue("test");
    service = new ApiKeyGeneratorService(config);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    container.clearInstances();
  });

  describe("generateApiKey", () => {
    it("should generate a valid API key", () => {
      const apiKey = service.generateApiKey();
      expect(apiKey).toMatch(FULL_API_KEY_PATTERN);
    });

    it("should generate unique keys", () => {
      const key1 = service.generateApiKey();
      const key2 = service.generateApiKey();
      expect(key1).not.toBe(key2);
    });

    it("should use correct environment prefix", () => {
      config.get.mockReturnValue("live");
      const testService = new ApiKeyGeneratorService(config);
      expect(testService.generateApiKey()).toMatch(/^ac\.sk\.live\./);

      config.get.mockReturnValue("tester");
      const testService2 = new ApiKeyGeneratorService(config);
      expect(testService2.generateApiKey()).toMatch(/^ac\.sk\.tester\./);
    });
  });

  describe("hashApiKey", () => {
    it("should generate consistent hashes", async () => {
      const apiKey = service.generateApiKey();
      const hash1 = await service.hashApiKey(apiKey);
      const hash2 = await service.hashApiKey(apiKey);

      expect(hash1).toMatch(HASHED_API_KEY_PATTERN);
      expect(await service.validateApiKey(apiKey, hash1)).toBe(true);
      expect(await service.validateApiKey(apiKey, hash2)).toBe(true);
    });

    it("should generate different hashes for different keys", async () => {
      const key1 = service.generateApiKey();
      const key2 = service.generateApiKey();

      const hash1 = await service.hashApiKey(key1);
      const hash2 = await service.hashApiKey(key2);

      expect(hash1).not.toBe(hash2);
      expect(await service.validateApiKey(key1, hash1)).toBe(true);
    });
  });

  describe("obfuscateApiKey", () => {
    it("should obfuscate API key correctly", () => {
      const apiKey = service.generateApiKey();
      const obfuscated = service.obfuscateApiKey(apiKey);

      expect(obfuscated).toMatch(OBFUSCATED_API_KEY_PATTERN);
      expect(obfuscated).not.toBe(apiKey);
    });

    it("should preserve prefix and environment", () => {
      const apiKey = service.generateApiKey();
      const obfuscated = service.obfuscateApiKey(apiKey);

      const [prefix1, type1, env1] = apiKey.split(".");
      const [prefix2, type2, env2] = obfuscated.split(".");

      expect(prefix1).toBe(prefix2);
      expect(type1).toBe(type2);
      expect(env1).toBe(env2);
    });

    it("should show first and last 6 characters of random segment", () => {
      const apiKey = service.generateApiKey();
      const obfuscated = service.obfuscateApiKey(apiKey);

      const randomSegment = apiKey.split(".")[3];
      const obfuscatedSegment = obfuscated.split(".")[3];

      expect(obfuscatedSegment.startsWith(randomSegment.slice(0, 6))).toBe(true);
      expect(obfuscatedSegment.endsWith(randomSegment.slice(-6))).toBe(true);
      expect(obfuscatedSegment).toContain("***");
    });
  });

  describe("validateApiKey", () => {
    it("should validate hashed key correctly", async () => {
      const apiKey = service.generateApiKey();
      const hashedKey = await service.hashApiKey(apiKey);

      expect(await service.validateApiKey(apiKey, hashedKey)).toBe(true);
    });

    it("should reject invalid keys", async () => {
      const apiKey = service.generateApiKey();
      const hashedKey = await service.hashApiKey(apiKey);
      const wrongKey = service.generateApiKey();

      expect(await service.validateApiKey(wrongKey, hashedKey)).toBe(false);
    });

    it("should reject tampered keys", async () => {
      const apiKey = service.generateApiKey();
      const hashedKey = await service.hashApiKey(apiKey);
      const tamperedKey = apiKey.replace("test", "live");

      expect(await service.validateApiKey(tamperedKey, hashedKey)).toBe(false);
    });
  });
});
