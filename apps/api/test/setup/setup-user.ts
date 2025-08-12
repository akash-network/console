import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserWalletRepository } from "@src/billing/repositories";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { UserRepository } from "@src/user/repositories";
import { apiNodeUrl } from "@src/utils/constants";

import { DeploymentGrantResponseSeeder } from "@test/seeders/deployment-grant-response.seeder";
import { DeploymentListResponseSeeder } from "@test/seeders/deployment-list-response.seeder";
import { FeeAllowanceResponseSeeder } from "@test/seeders/fee-allowance-response.seeder";
import { stub } from "@test/services/stub";
import { WalletTestingService } from "@test/services/wallet-testing.service";

export type SetupUserOptions = {
  walletNotFound?: boolean;
};

const mockMasterWalletAddress = "akash1testmasterwalletaddress";
const mockDeploymentGrantDenom = "uakt";

export const setupUser = async (options?: SetupUserOptions) => {
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
      .get(/\/akash\/deployment\/v1beta3\/deployments\/list\?.*/)
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
};

export const teardownUser = () => {
  jest.restoreAllMocks();
  nock.cleanAll();
};
