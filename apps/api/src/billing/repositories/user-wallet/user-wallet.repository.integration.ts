import { faker } from "@faker-js/faker";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { UserRepository } from "@src/user/repositories";
import { UserWalletRepository } from "./user-wallet.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(UserWalletRepository.name, () => {
  describe("claimActivation", () => {
    it("claims activation exactly once across concurrent attempts", async () => {
      const { userWalletRepository, wallet } = await setup();

      const results = await Promise.all(Array.from({ length: 5 }, () => userWalletRepository.claimActivation(wallet.id)));

      const claimed = results.filter(Boolean);
      expect(claimed).toHaveLength(1);
      expect(claimed[0]?.activatedAt).toBeInstanceOf(Date);
    });

    it("returns undefined when the wallet is already activated", async () => {
      const { userWalletRepository, wallet } = await setup();

      const first = await userWalletRepository.claimActivation(wallet.id);
      const second = await userWalletRepository.claimActivation(wallet.id);

      expect(first?.activatedAt).toBeInstanceOf(Date);
      expect(second).toBeUndefined();
    });

    it("claims again after activation is unset", async () => {
      const { userWalletRepository, wallet } = await setup();

      const first = await userWalletRepository.claimActivation(wallet.id);
      await userWalletRepository.updateById(wallet.id, { activatedAt: null });
      const second = await userWalletRepository.claimActivation(wallet.id);

      expect(first?.activatedAt).toBeInstanceOf(Date);
      expect(second?.activatedAt).toBeInstanceOf(Date);
    });
  });

  async function setup() {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);

    const user = await userRepository.create({ userId: faker.string.uuid() });
    const wallet = await userWalletRepository.create({ userId: user.id, address: createAkashAddress() });

    return { userRepository, userWalletRepository, user, wallet };
  }
});
