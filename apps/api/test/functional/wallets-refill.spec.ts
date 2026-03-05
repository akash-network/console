import nock from "nock";
import { container } from "tsyringe";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WalletController } from "@src/billing/controllers/wallet/wallet.controller";
import type { BillingConfig } from "@src/billing/providers";
import { BILLING_CONFIG } from "@src/billing/providers";
import { UserWalletRepository } from "@src/billing/repositories";
import { ManagedUserWalletService } from "@src/billing/services";
import type { ApiPgDatabase } from "@src/core";
import { CORE_CONFIG } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";
import { DeploymentGrantResponseSeeder } from "@test/seeders/deployment-grant-response.seeder";
import { FeeAllowanceResponseSeeder } from "@test/seeders/fee-allowance-response.seeder";

describe("Wallets Refill", () => {
  const managedUserWalletService = container.resolve(ManagedUserWalletService);
  const config = container.resolve<BillingConfig>(BILLING_CONFIG);
  const walletController = container.resolve(WalletController);
  const userWalletRepository = container.resolve(UserWalletRepository);
  const userRepository = container.resolve(UserRepository);
  const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
  const userWalletsTable = resolveTable("UserWallets");

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  describe("console refill-wallets", () => {
    it("refills wallets low on fee allowance", async () => {
      const wallets = await setup();

      await walletController.refillWallets();

      await Promise.all(
        wallets.map(async wallet => {
          const walletRecord = await userWalletRepository.findById(wallet.id);
          expect(walletRecord?.feeAllowance).toBe(config.FEE_ALLOWANCE_REFILL_AMOUNT);
        })
      );
    });
  });

  async function setup() {
    vi.spyOn(managedUserWalletService, "authorizeSpending").mockResolvedValue(undefined);

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/feegrant\/v1beta1\/allowance\/.*\/.*/)
      .reply(200, FeeAllowanceResponseSeeder.create({ amount: String(config.FEE_ALLOWANCE_REFILL_AMOUNT) }));

    nock(container.resolve(CORE_CONFIG).REST_API_NODE_URL)
      .persist()
      .get(/\/cosmos\/authz\/v1beta1\/grants\?.*/)
      .reply(200, DeploymentGrantResponseSeeder.create({ amount: String(config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT) }));

    const NUMBER_OF_WALLETS = 5;
    return Promise.all(
      Array.from({ length: NUMBER_OF_WALLETS }).map(async (_, index) => {
        const user = await userRepository.create({});
        const address = createAkashAddress();
        const [wallet] = await db
          .insert(userWalletsTable)
          .values({
            userId: user.id,
            address,
            isTrialing: index === NUMBER_OF_WALLETS - 1,
            deploymentAllowance: String(config.TRIAL_DEPLOYMENT_ALLOWANCE_AMOUNT),
            feeAllowance: String(config.FEE_ALLOWANCE_REFILL_THRESHOLD)
          })
          .returning();
        return wallet;
      })
    );
  }
});
