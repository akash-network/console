import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { CreateCertificateResponse } from "@src/certificate/http-schemas/create-certificate.schema";
import { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { UserRepository } from "@src/user/repositories";

import { DbTestingService } from "@test/services/db-testing.service";
import { stub } from "@test/services/stub";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

describe("Certificate API", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyRepository = container.resolve(ApiKeyRepository);
  const dbService = container.resolve(DbTestingService);
  const walletService = new WalletTestingService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);
  let apiKeyGenerator: ApiKeyGeneratorService;
  let config: jest.Mocked<CoreConfigService>;

  async function createTestUser() {
    const { user, token, wallet } = await walletService.createUserAndWallet();
    const userWithId = { ...user, userId: faker.string.uuid() };
    config = stub<CoreConfigService>({ get: jest.fn() });
    config.get.mockReturnValue("test");
    apiKeyGenerator = new ApiKeyGeneratorService(config);
    const apiKey = apiKeyGenerator.generateApiKey();
    const obfuscatedKey = apiKeyGenerator.obfuscateApiKey(apiKey);

    jest.spyOn(userRepository, "findById").mockImplementation(async id => {
      if (id === userWithId.userId) {
        return {
          ...userWithId,
          trial: false,
          userWallets: { isTrialing: false }
        };
      }
      return undefined;
    });

    jest.spyOn(apiKeyRepository, "findOneBy").mockImplementation(async key => {
      if (key.keyFormat === obfuscatedKey) {
        const now = new Date().toISOString();
        return {
          id: faker.string.uuid(),
          userId: userWithId.userId,
          key: apiKey,
          hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
          keyFormat: "sk",
          name: "test",
          createdAt: now,
          updatedAt: now,
          expiresAt: null,
          lastUsedAt: null
        };
      }
      return undefined;
    });

    jest.spyOn(userWalletRepository, "findOneByUserId").mockImplementation(async id => {
      if (id === user.id) {
        return {
          ...wallet,
          address: wallet.address
        };
      }
    });

    return { user: userWithId, token, apiKey, wallet };
  }

  beforeEach(async () => {
    await dbService.cleanAll();
  });

  describe("POST /v1/certificate/create", () => {
    it("creates a certificate for the authenticated user", async () => {
      const { apiKey, wallet } = await createTestUser();

      const response = await app.request("/v1/certificates", {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          "x-api-key": apiKey
        })
      });

      expect(response.status).toBe(200);
      const result = (await response.json()) as CreateCertificateResponse;

      expect(result.certPem).toBeDefined();
      expect(result.pubkeyPem).toBeDefined();
      expect(result.encryptedKey).toBeDefined();

      const cert = certificateManager.parsePem(result.certPem);
      expect(cert.sSubject).toContain(wallet.address);
    });

    it("returns 401 for an unauthenticated request", async () => {
      const response = await app.request("/v1/certificates", {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" })
      });

      expect(response.status).toBe(401);
    });
  });
});
