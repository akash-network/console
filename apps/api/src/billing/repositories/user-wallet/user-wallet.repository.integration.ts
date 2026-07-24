import { faker } from "@faker-js/faker";
import subMinutes from "date-fns/subMinutes";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { UserRepository } from "@src/user/repositories";
import { UserWalletRepository } from "./user-wallet.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

describe(UserWalletRepository.name, () => {
  describe("claimActivation", () => {
    it("claims exactly once across concurrent attempts without stamping activation", async () => {
      const { userWalletRepository, wallet } = await setup();

      const results = await Promise.all(Array.from({ length: 5 }, () => userWalletRepository.claimActivation(wallet.id)));

      const claimed = results.filter(Boolean);
      expect(claimed).toHaveLength(1);
      expect(claimed[0]?.activationClaimedAt).toBeInstanceOf(Date);
      expect(claimed[0]?.activatedAt).toBeNull();
    });

    it("returns undefined while another claim is live", async () => {
      const { userWalletRepository, wallet } = await setup();

      const first = await userWalletRepository.claimActivation(wallet.id);
      const second = await userWalletRepository.claimActivation(wallet.id);

      expect(first?.activationClaimedAt).toBeInstanceOf(Date);
      expect(second).toBeUndefined();
    });

    it("returns undefined when the wallet is already activated", async () => {
      const { userWalletRepository, wallet } = await setup();

      await userWalletRepository.markActivated(wallet.id);
      const claimed = await userWalletRepository.claimActivation(wallet.id);

      expect(claimed).toBeUndefined();
    });

    it("claims again after the previous claim is released", async () => {
      const { userWalletRepository, wallet } = await setup();

      const first = await userWalletRepository.claimActivation(wallet.id);
      await userWalletRepository.releaseActivationClaim(wallet.id, first!.activationClaimedAt!);
      const second = await userWalletRepository.claimActivation(wallet.id);

      expect(second?.activationClaimedAt).toBeInstanceOf(Date);
    });

    it("takes over a claim older than the stale cutoff", async () => {
      const { userWalletRepository, wallet } = await setup();

      const staleClaimedAt = subMinutes(new Date(), UserWalletRepository.ACTIVATION_CLAIM_STALE_AFTER_MINUTES + 1);
      await userWalletRepository.updateById(wallet.id, { activationClaimedAt: staleClaimedAt });
      const claimed = await userWalletRepository.claimActivation(wallet.id);

      expect(claimed?.activationClaimedAt).toBeInstanceOf(Date);
      expect(claimed?.activationClaimedAt?.getTime()).toBeGreaterThan(staleClaimedAt.getTime());
    });
  });

  describe("releaseActivationClaim", () => {
    it("keeps a claim intact when released with another attempt's claim timestamp", async () => {
      const { userWalletRepository, wallet } = await setup();

      await userWalletRepository.claimActivation(wallet.id);
      await userWalletRepository.releaseActivationClaim(wallet.id, faker.date.past());
      const concurrentClaim = await userWalletRepository.claimActivation(wallet.id);

      expect(concurrentClaim).toBeUndefined();
    });
  });

  describe("markActivated", () => {
    it("stamps activation and clears any live claim", async () => {
      const { userWalletRepository, wallet } = await setup();

      await userWalletRepository.claimActivation(wallet.id);
      const activated = await userWalletRepository.markActivated(wallet.id);

      expect(activated?.activatedAt).toBeInstanceOf(Date);
      expect(activated?.activationClaimedAt).toBeNull();
    });

    it("no-ops for an already-activated wallet", async () => {
      const { userWalletRepository, wallet } = await setup();

      const first = await userWalletRepository.markActivated(wallet.id);
      const second = await userWalletRepository.markActivated(wallet.id);

      expect(first?.activatedAt).toBeInstanceOf(Date);
      expect(second).toBeUndefined();
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
