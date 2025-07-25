import { certificateManager } from "@akashnetwork/akashjs/build/certificates/certificate-manager";
import { faker } from "@faker-js/faker";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserWalletRepository } from "@src/billing/repositories";
import type { CreateCertificateResponse } from "@src/certificate/http-schemas/create-certificate.schema";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { UserRepository } from "@src/user/repositories";

import { stub } from "@test/services/stub";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(30000);

describe("Certificate API", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyRepository = container.resolve(ApiKeyRepository);
  const walletService = new WalletTestingService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);
  let apiKeyGenerator: ApiKeyGeneratorService;
  let config: jest.Mocked<CoreConfigService>;

  async function createTestUser() {
    const { user, token, wallet } = await walletService.createAnonymousUserAndWallet();
    const userWithId = { ...user, userId: faker.string.uuid() };
    config = stub<CoreConfigService>({ get: jest.fn() });
    config.get.mockReturnValue("test");
    apiKeyGenerator = new ApiKeyGeneratorService(config);
    const apiKey = apiKeyGenerator.generateApiKey();

    jest.spyOn(userRepository, "findById").mockImplementation(async id => {
      if (id === userWithId.id) {
        return {
          ...userWithId,
          trial: false,
          userWallets: { isTrialing: false }
        };
      }
      return undefined;
    });

    jest.spyOn(apiKeyRepository, "find").mockImplementation(async () => {
      const now = new Date().toISOString();
      return [
        {
          id: faker.string.uuid(),
          userId: userWithId.id,
          key: apiKey,
          hashedKey: await apiKeyGenerator.hashApiKey(apiKey),
          keyFormat: "sk",
          name: "test",
          createdAt: now,
          updatedAt: now,
          expiresAt: null,
          lastUsedAt: null
        }
      ];
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

      expect(result.data).toMatchObject({
        certPem: expect.any(String),
        pubkeyPem: expect.any(String),
        encryptedKey: expect.any(String)
      });
      const cert = certificateManager.parsePem(result.data!.certPem!);
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
