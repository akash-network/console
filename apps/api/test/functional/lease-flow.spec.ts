import { BlockHttpService } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { setTimeout as delay } from "timers/promises";
import { container } from "tsyringe";

import { app } from "@src/app";
import { ApiKeyRepository } from "@src/auth/repositories/api-key/api-key.repository";
import { ApiKeyGeneratorService } from "@src/auth/services/api-key/api-key-generator.service";
import type { BidResponse } from "@src/bid/http-schemas/bid.schema";
import { UserWalletRepository } from "@src/billing/repositories";
import type { CoreConfigService } from "@src/core/services/core-config/core-config.service";
import { ProviderService } from "@src/provider/services/provider/provider.service";
import { UserRepository } from "@src/user/repositories";

import { createSdlYml } from "@test/mocks/template";
import { LeaseStatusSeeder } from "@test/seeders/lease-status.seeder";
import { stub } from "@test/services/stub";
import { WalletTestingService } from "@test/services/wallet-testing.service";

jest.setTimeout(120_000); // 120 seconds for the full flow

describe("Lease Flow", () => {
  const userRepository = container.resolve(UserRepository);
  const apiKeyRepository = container.resolve(ApiKeyRepository);
  const blockHttpService = container.resolve(BlockHttpService);
  const walletService = new WalletTestingService(app);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const providerService = container.resolve(ProviderService);
  let apiKeyGenerator: ApiKeyGeneratorService;
  let config: jest.Mocked<CoreConfigService>;
  let currentHeight: number;
  const yml = createSdlYml();

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
        return { ...wallet, isTrialing: false, feeAllowance: 1_000_000, deploymentAllowance: 1_000_000 };
      }
      return undefined;
    });

    jest.spyOn(userWalletRepository, "accessibleBy").mockReturnValue(userWalletRepository);
    jest.spyOn(userWalletRepository, "findOneByUserId").mockImplementation(findOneByUserIdMock);

    return { user: userWithId, apiKey, wallet };
  }

  beforeEach(() => {
    currentHeight = faker.number.int({ min: 1000000, max: 10000000 });
    jest.spyOn(blockHttpService, "getCurrentHeight").mockResolvedValue(currentHeight);

    // Mock provider service methods
    jest.spyOn(providerService, "sendManifest").mockResolvedValue(true);
    jest.spyOn(providerService, "getLeaseStatus").mockResolvedValue(LeaseStatusSeeder.create());
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  async function waitForBids(dseq: string, owner: string, apiKey: string, maxAttempts = 10): Promise<BidResponse[]> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await app.request(`/v1/bids?dseq=${dseq}&owner=${owner}`, {
        method: "GET",
        headers: new Headers({
          "Content-Type": "application/json",
          "x-api-key": apiKey
        })
      });

      const result = (await response.json()) as { data: BidResponse[] };
      if (result.data?.length > 0) {
        return result.data;
      }

      await delay(3000);
    }
    throw new Error("No bids received after maximum attempts");
  }

  it("should execute complete lease lifecycle", async () => {
    // 1. Setup user and get authentication
    const { apiKey, wallet } = await createTestUser();

    // 2. Check initial balances
    const initialBalancesResponse = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });
    expect(initialBalancesResponse.status).toBe(200);
    const { data: initialBalances } = (await initialBalancesResponse.json()) as { data: { balance: number; deployments: number; total: number } };
    const initialBalance = initialBalances.balance;
    const initialDeployments = initialBalances.deployments;
    const initialTotal = initialBalances.total;

    // 3. Create certificate
    const certResponse = await app.request("/v1/certificates", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
    expect(certResponse.status).toBe(200);
    const { certPem, encryptedKey } = ((await certResponse.json()) as any).data;

    // 4. Create deployment
    const deployResponse = await app.request("/v1/deployments", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey }),
      body: JSON.stringify({
        data: {
          sdl: yml,
          deposit: 5
        }
      })
    });
    expect(deployResponse.status).toBe(201);
    const { dseq, manifest } = ((await deployResponse.json()) as any).data;

    // 5. Check balances after deployment creation
    const afterDeployBalancesResponse = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });
    expect(afterDeployBalancesResponse.status).toBe(200);
    const afterDeployBalances = ((await afterDeployBalancesResponse.json()) as any).data;
    // Balance should be reduced by the deposit amount
    expect(afterDeployBalances.balance).toBeLessThan(initialBalance);
    // Deployments should be increased by the deposit amount
    expect(afterDeployBalances.deployments).toBeGreaterThan(initialDeployments);
    // Total should remain the same
    expect(afterDeployBalances.total).toBe(initialTotal);

    // 6. Wait for and get bids
    const bids = await waitForBids(dseq, wallet.address, apiKey);
    expect(bids.length).toBeGreaterThan(0);
    const firstBid = bids[0];

    const body = {
      manifest,
      certificate: {
        certPem,
        keyPem: encryptedKey
      },
      leases: [
        {
          dseq,
          gseq: firstBid.bid.bid_id.gseq,
          oseq: firstBid.bid.bid_id.oseq,
          provider: firstBid.bid.bid_id.provider
        }
      ]
    };

    // 7. Create lease and send manifest
    const leaseResponse = await app.request("/v1/leases", {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey }),
      body: JSON.stringify(body)
    });
    expect(leaseResponse.status).toBe(200);
    const leaseResult = (await leaseResponse.json()) as any;
    expect(leaseResult.data.leases[0].status).toEqual(LeaseStatusSeeder.create());

    // 8. Deposit into deployment
    const depositResponse = await app.request(`/v1/deposit-deployment`, {
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey }),
      body: JSON.stringify({ data: { dseq, deposit: 0.5 } })
    });
    expect(depositResponse.status).toBe(200);

    // 9. Check balances after deposit
    const afterDepositBalancesResponse = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });
    expect(afterDepositBalancesResponse.status).toBe(200);
    const afterDepositBalances = ((await afterDepositBalancesResponse.json()) as any).data;
    // Balance should be reduced by the additional deposit amount
    expect(afterDepositBalances.balance).toBeLessThan(afterDeployBalances.balance);
    // Deployments should be increased by the additional deposit amount
    expect(afterDepositBalances.deployments).toBeGreaterThan(afterDeployBalances.deployments);
    // Total should remain the same
    expect(afterDepositBalances.total).toBe(initialTotal);

    const ymlUpdate = createSdlYml({
      "services.web.image": { $set: "baktun/hello-akash-world:1.0.1" },
      "services.web.env": { $set: ["NEW_FEATURE=enabled"] }
    });

    // 10. Update deployment
    const updateResponse = await app.request(`/v1/deployments/${dseq}`, {
      method: "PUT",
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey }),
      body: JSON.stringify({ data: { sdl: ymlUpdate, certificate: { certPem, keyPem: encryptedKey } } })
    });
    expect(updateResponse.status).toBe(200);
    const updateResult = (await updateResponse.json()) as any;
    expect(updateResult.data.leases[0].status).toEqual(LeaseStatusSeeder.create());

    // 11. Close deployment
    const closeResponse = await app.request(`/v1/deployments/${dseq}`, {
      method: "DELETE",
      headers: new Headers({ "Content-Type": "application/json", "x-api-key": apiKey })
    });
    expect(closeResponse.status).toBe(200);
    const closeResult = (await closeResponse.json()) as any;
    expect(closeResult.data.success).toBe(true);

    // 12. Check final balances
    const finalBalancesResponse = await app.request("/v1/balances", {
      method: "GET",
      headers: new Headers({
        "Content-Type": "application/json",
        "x-api-key": apiKey
      })
    });
    expect(finalBalancesResponse.status).toBe(200);
    const finalBalances = ((await finalBalancesResponse.json()) as any).data;
    // Balance should be increased back to initial level (minus fees)
    expect(finalBalances.balance).toBeGreaterThan(afterDepositBalances.balance);
    // Deployments should be decreased back to initial level
    expect(finalBalances.deployments).toBeLessThan(afterDepositBalances.deployments);
    // Total should be less than initial total due to fees
    expect(finalBalances.total).toBeLessThan(initialTotal);
  });
});
