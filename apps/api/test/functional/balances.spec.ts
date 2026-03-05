import { faker } from "@faker-js/faker";
import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import { UserWalletRepository } from "@src/billing/repositories";
import { CORE_CONFIG } from "@src/core";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { app } from "@src/rest-app";
import { UserRepository } from "@src/user/repositories";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { DeploymentGrantResponseSeeder } from "@test/seeders/deployment-grant-response.seeder";
import { DeploymentListResponseSeeder } from "@test/seeders/deployment-list-response.seeder";
import { FeeAllowanceResponseSeeder } from "@test/seeders/fee-allowance-response.seeder";
import { UserWalletSeeder } from "@test/seeders/user-wallet.seeder";

const mockMasterWalletAddress = "akash1testmasterwalletaddress";

describe("Balances", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("gets balances for the current user", async () => {
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

    expect(result.data.deployments).toBe(1000000);
  });

  it("gets balances for a specific address", async () => {
    await setup();

    const differentAddress = createAkashAddress();

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

    expect(result.data.deployments).toBe(1000000);
  });

  it("returns 404 when user wallet is not found", async () => {
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

  it("returns 400 for invalid address format (UUID)", async () => {
    await setup();

    const invalidAddress = "60bb76fa-9c5d-4f7f-ae11-e4f694909b9e";

    const response = await app.request(`/v1/balances?address=${invalidAddress}`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json"
      })
    });

    expect(response.status).toBe(400);
    const result = (await response.json()) as any;
    expect(result.error).toBeDefined();
  });

  it("returns 400 for address with wrong prefix", async () => {
    await setup();

    // Valid bech32 address but with wrong prefix (cosmos instead of akash)
    const invalidAddress = "cosmos13265twfqejnma6cc93rw5dxk4cldyz2zd2vul9";

    const response = await app.request(`/v1/balances?address=${invalidAddress}`, {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json"
      })
    });

    expect(response.status).toBe(400);
    const result = (await response.json()) as any;
    expect(result.error).toBeDefined();
  });

  async function setup(input: { walletNotFound?: boolean } = {}) {
    const apiKeyRepository = container.resolve(ApiKeyRepository);
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);

    const user = await userRepository.create({});
    const userWithId = { ...user, userId: faker.string.uuid() };
    const wallet = UserWalletSeeder.create({ userId: user.id, address: createAkashAddress() });

    const config = mock<CoreConfigService>({
      get: vi.fn().mockReturnValue("test")
    });
    const apiKeyGenerator = new ApiKeyGeneratorService(config);
    const apiKey = apiKeyGenerator.generateApiKey();

    vi.spyOn(userRepository, "findById").mockImplementation(async id => {
      if (id === userWithId.id) {
        return {
          ...userWithId,
          trial: false,
          userWallets: { isTrialing: false }
        };
      }
      return undefined;
    });

    vi.spyOn(apiKeyRepository, "find").mockImplementation(async () => {
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

    vi.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(userWalletRepository);
    vi.spyOn(userWalletRepository, "findOneByUserId").mockImplementation(async id => {
      if (id === userWithId.id) {
        return input.walletNotFound ? undefined : wallet;
      }
      return undefined;
    });

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(
        200,
        FeeAllowanceResponseSeeder.create({
          granter: mockMasterWalletAddress,
          grantee: wallet.address || undefined,
          amount: "1000000"
        })
      );

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(
        200,
        DeploymentGrantResponseSeeder.create({
          granter: mockMasterWalletAddress,
          grantee: wallet.address || undefined,
          amount: "5000000"
        })
      );

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/akash\/deployment\/v1beta4\/deployments\/list\?.*/)
      .reply(
        200,
        DeploymentListResponseSeeder.create({
          owner: wallet.address || undefined,
          amount: "1000000"
        })
      );

    return { user: userWithId, apiKey, wallet };
  }
});
