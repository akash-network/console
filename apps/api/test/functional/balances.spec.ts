import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserWalletRepository } from "@src/billing/repositories";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";
import { apiNodeUrl } from "@src/utils/constants";

import { DeploymentGrantResponseSeeder } from "@test/seeders/deployment-grant-response.seeder";
import { DeploymentListResponseSeeder } from "@test/seeders/deployment-list-response.seeder";
import { FeeAllowanceResponseSeeder } from "@test/seeders/fee-allowance-response.seeder";
import { stub } from "@test/services/stub";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(20000);

describe("Balances", () => {
  const mockMasterWalletAddress = "akash1testmasterwalletaddress";
  const mockDeploymentGrantDenom = "uakt";

  afterEach(() => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    nock.cleanAll();
  });

  it("should get balances for the current user", async () => {
    const { apiKey } = await setup();

    const response = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;

    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("balance");
    expect(result.data).toHaveProperty("deployments");
    expect(result.data).toHaveProperty("total");

    expect(typeof result.data.balance).toBe("number");
    expect(typeof result.data.deployments).toBe("number");
    expect(typeof result.data.total).toBe("number");

    expect(result.data.total).toBe(result.data.balance + result.data.deployments);

    expect(result.data.deployments).toBe(2000000);
  });

  it("should get balances for a specific address", async () => {
    await setup();

    const differentAddress = faker.string.alphanumeric(44);

    const response = await app.request(`/v1/balances?address=${differentAddress}`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json"
      })
    });

    expect(response.status).toBe(200);
    const result = (await response.json()) as any;

    expect(result).toHaveProperty("data");
    expect(result.data).toHaveProperty("balance");
    expect(result.data).toHaveProperty("deployments");
    expect(result.data).toHaveProperty("total");

    expect(typeof result.data.balance).toBe("number");
    expect(typeof result.data.deployments).toBe("number");
    expect(typeof result.data.total).toBe("number");

    expect(result.data.total).toBe(result.data.balance + result.data.deployments);

    expect(result.data.deployments).toBe(2000000);
  });

  it("should return 404 when user wallet is not found", async () => {
    const { apiKey } = await setup({ walletNotFound: true });

    const response = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });

    expect(response.status).toBe(404);
  });

  async function setup(options?: SetupOptions) {
    const di = container.createChildContainer();
    const userRepository = di.resolve(UserRepository);
    const apiKeyRepository = di.resolve(ApiKeyRepository);
    const userWalletRepository = di.resolve(UserWalletRepository);
    const walletService = new WalletTestingService(app);

    let apiKeyGenerator: ApiKeyGeneratorService;
    let config: jest.Mocked<CoreConfigService>;

    async function createTestUser() {
      const { user, wallet } = await walletService.createUserAndWallet();
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

      const findOneByUserIdMock = jest.fn().mockImplementation(async (id: string) => {
        if (id === userWithId.id) {
          return options?.walletNotFound ? undefined : wallet;
        }
        return undefined;
      });

      jest.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(userWalletRepository);
      jest.spyOn(userWalletRepository, "findOneByUserId").mockImplementation(findOneByUserIdMock);

      nock(apiNodeUrl)
        .persist()
        .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
        .reply(
          200,
          FeeAllowanceResponseSeeder.create({
            granter: mockMasterWalletAddress,
            grantee: wallet.address,
            amount: "1000000"
          })
        );

      nock(apiNodeUrl)
        .persist()
        .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
        .reply(
          200,
          DeploymentGrantResponseSeeder.create({
            granter: mockMasterWalletAddress,
            grantee: wallet.address,
            amount: "5000000"
          })
        );

      nock(apiNodeUrl)
        .persist()
        .get(/\/akash\/deployment\/v1beta4\/deployments\/list\?.*/)
        .reply(
          200,
          DeploymentListResponseSeeder.create({
            owner: wallet.address,
            amount: "1000000"
          })
        );

      return { user: userWithId, apiKey, wallet };
    }

    const mockMasterWallet = {
      getFirstAddress: jest.fn().mockResolvedValue(mockMasterWalletAddress)
    };

    const mockBillingConfig = {
      get: jest.fn().mockReturnValue(mockDeploymentGrantDenom)
    };

    di.registerInstance("MANAGED", mockMasterWallet);
    di.registerInstance("BillingConfig", mockBillingConfig);

    const { user, apiKey, wallet } = await createTestUser();

    return {
      di,
      user,
      apiKey,
      wallet
    };
  }

  interface SetupOptions {
    walletNotFound?: boolean;
  }
});
