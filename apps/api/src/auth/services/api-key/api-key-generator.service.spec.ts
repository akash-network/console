import { container } from "tsyringe";

import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";

const FULL_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{64}$/;
const OBFUSCATED_API_KEY_PATTERN = /^ac\.sk\.test\.[A-Za-z0-9]{6}\*{3}[A-Za-z0-9]{6}$/;
const HASHED_API_KEY_PATTERN = /^[a-f0-9]{64}$/;

describe("ApiKeyGeneratorService", () => {
  let service: ApiKeyGeneratorService;
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.NODE_ENV;
    service = container.resolve(ApiKeyGeneratorService);
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
      process.env.NODE_ENV = "production";
      expect(service.generateApiKey()).toMatch(/^ac\.sk\.live\./);

      process.env.NODE_ENV = "test";
      expect(service.generateApiKey()).toMatch(/^ac\.sk\.test\./);
    });
  });

  describe("hashApiKey", () => {
    it("should hash API key consistently", () => {
      const apiKey = service.generateApiKey();
      const hash1 = service.hashApiKey(apiKey);
      const hash2 = service.hashApiKey(apiKey);

      expect(hash1).toMatch(HASHED_API_KEY_PATTERN);
      expect(hash1).toBe(hash2);
    });

    it("should generate different hashes for different keys", () => {
      const key1 = service.generateApiKey();
      const key2 = service.generateApiKey();

      expect(service.hashApiKey(key1)).not.toBe(service.hashApiKey(key2));
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
    it("should validate hashed key correctly", () => {
      const apiKey = service.generateApiKey();
      const hashedKey = service.hashApiKey(apiKey);

      expect(service.validateApiKey(apiKey, hashedKey)).toBe(true);
    });

    it("should reject invalid keys", () => {
      const apiKey = service.generateApiKey();
      const hashedKey = service.hashApiKey(apiKey);
      const wrongKey = service.generateApiKey();

      expect(service.validateApiKey(wrongKey, hashedKey)).toBe(false);
    });

    it("should reject tampered keys", () => {
      const apiKey = service.generateApiKey();
      const hashedKey = service.hashApiKey(apiKey);
      const tamperedKey = apiKey.replace("test", "live");

      expect(service.validateApiKey(tamperedKey, hashedKey)).toBe(false);
    });
  });
});
