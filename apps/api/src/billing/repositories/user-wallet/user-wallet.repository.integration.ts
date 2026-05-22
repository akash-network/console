import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { afterEach, describe, expect, it } from "vitest";

import type { UserWalletStatus } from "@src/billing/model-schemas/user-wallet/user-wallet.schema";
import type { ApiPgDatabase } from "@src/core";
import { POSTGRES_DB, resolveTable } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { UserWalletRepository } from "./user-wallet.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(UserWalletRepository.name, () => {
  const createdUserIds: string[] = [];
  const createdWalletIds: number[] = [];

  afterEach(async () => {
    const userWalletRepository = container.resolve(UserWalletRepository);
    const userRepository = container.resolve(UserRepository);

    if (createdWalletIds.length > 0) {
      await userWalletRepository.deleteById(createdWalletIds);
    }
    if (createdUserIds.length > 0) {
      await userRepository.deleteById(createdUserIds);
    }

    createdWalletIds.length = 0;
    createdUserIds.length = 0;
  });

  describe("findOneByUserId", () => {
    it("returns wallet including status", async () => {
      const { userWalletRepository, createTestWallet } = setup();
      const wallet = await createTestWallet({ status: "pending" });

      const found = await userWalletRepository.findOneByUserId(wallet.userId);

      expect(found?.status).toBe("pending");
    });
  });

  describe("updateStatus", () => {
    it("updates status to failed via updateStatus", async () => {
      const { userWalletRepository, createTestWallet } = setup();
      const wallet = await createTestWallet({ status: "pending" });

      await userWalletRepository.updateStatus(wallet.id, "failed");

      const found = await userWalletRepository.findOneByUserId(wallet.userId);
      expect(found?.status).toBe("failed");
    });
  });

  function setup() {
    const userWalletRepository = container.resolve(UserWalletRepository);
    const userRepository = container.resolve(UserRepository);
    const db = container.resolve<ApiPgDatabase>(POSTGRES_DB);
    const userWalletsTable = resolveTable("UserWallets");

    async function createTestWallet(overrides: { status?: UserWalletStatus; address?: string } = {}) {
      const user = await userRepository.create({
        id: faker.string.uuid(),
        userId: faker.string.uuid(),
        username: `testuser_${Date.now()}_${faker.string.alphanumeric(6)}`,
        email: faker.internet.email(),
        emailVerified: false,
        subscribedToNewsletter: false
      });
      createdUserIds.push(user.id);

      const [wallet] = await db
        .insert(userWalletsTable)
        .values({
          userId: user.id,
          address: overrides.address ?? createAkashAddress(),
          status: overrides.status
        })
        .returning();
      createdWalletIds.push(wallet.id);

      return wallet;
    }

    return { userWalletRepository, createTestWallet };
  }
});
