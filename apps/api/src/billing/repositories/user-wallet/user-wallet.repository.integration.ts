import { faker } from "@faker-js/faker";
import subMinutes from "date-fns/subMinutes";
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

  describe("clearCreditsLowNotifiedIfRecoveryConfirmed", () => {
    it("clears the notified stamp once credits have read sufficient for the whole window", async () => {
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt: subMinutes(new Date(), 90),
        creditsSufficientSince: subMinutes(new Date(), 31),
        creditsLowSince: subMinutes(new Date(), 120)
      });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, 30);

      const updated = await userWalletRepository.findById(wallet.id);
      expect(isCleared).toBe(true);
      expect(updated?.creditsLowNotifiedAt).toBeNull();
      expect(updated?.creditsSufficientSince).toBeNull();
      expect(updated?.creditsLowSince).toBeNull();
    });

    it("keeps the notified stamp while the window has not elapsed", async () => {
      const creditsLowNotifiedAt = subMinutes(new Date(), 90);
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt,
        creditsSufficientSince: subMinutes(new Date(), 5)
      });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, 30);

      const updated = await userWalletRepository.findById(wallet.id);
      expect(isCleared).toBe(false);
      expect(updated?.creditsLowNotifiedAt).toEqual(creditsLowNotifiedAt);
    });

    it("keeps the notified stamp when no recovery has been recorded", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsLowNotifiedAt: subMinutes(new Date(), 90) });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, 30);

      expect(isCleared).toBe(false);
    });

    it("reports no clear when the wallet was never notified", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsSufficientSince: subMinutes(new Date(), 90) });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, 30);

      expect(isCleared).toBe(false);
    });

    it("clears exactly once across concurrent attempts", async () => {
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt: subMinutes(new Date(), 90),
        creditsSufficientSince: subMinutes(new Date(), 31)
      });

      const results = await Promise.all(Array.from({ length: 5 }, () => userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, 30)));

      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });

  describe("isCreditsLowConfirmed", () => {
    it("confirms once credits have read low for the whole window", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsLowSince: subMinutes(new Date(), 31) });

      expect(await userWalletRepository.isCreditsLowConfirmed(wallet.id, 30)).toBe(true);
    });

    it("withholds confirmation while the window has not elapsed", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsLowSince: subMinutes(new Date(), 5) });

      expect(await userWalletRepository.isCreditsLowConfirmed(wallet.id, 30)).toBe(false);
    });

    it("withholds confirmation when no low reading has been recorded", async () => {
      const { userWalletRepository, wallet } = await setup();

      expect(await userWalletRepository.isCreditsLowConfirmed(wallet.id, 30)).toBe(false);
    });

    it("withholds confirmation when the wallet was already notified", async () => {
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt: subMinutes(new Date(), 90),
        creditsLowSince: subMinutes(new Date(), 91)
      });

      expect(await userWalletRepository.isCreditsLowConfirmed(wallet.id, 30)).toBe(false);
    });

    it("confirms immediately when the window is disabled", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsLowSince: new Date() });

      expect(await userWalletRepository.isCreditsLowConfirmed(wallet.id, 0)).toBe(true);
    });
  });

  describe("findByAddresses", () => {
    it("returns every wallet matching the given addresses", async () => {
      const first = await setup();
      const second = await setup();

      const wallets = await first.userWalletRepository.findByAddresses([first.wallet.address as string, second.wallet.address as string]);

      expect(wallets.map(wallet => wallet.address).sort()).toEqual([first.wallet.address, second.wallet.address].sort());
    });

    it("skips addresses that have no wallet", async () => {
      const { userWalletRepository, wallet } = await setup();

      const wallets = await userWalletRepository.findByAddresses([wallet.address as string, createAkashAddress()]);

      expect(wallets).toHaveLength(1);
      expect(wallets[0].address).toBe(wallet.address);
    });

    it("returns nothing when given no addresses", async () => {
      const { userWalletRepository } = await setup();

      expect(await userWalletRepository.findByAddresses([])).toEqual([]);
    });
  });

  async function setup(input: { creditsLowNotifiedAt?: Date; creditsSufficientSince?: Date; creditsLowSince?: Date } = {}) {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);

    const user = await userRepository.create({ userId: faker.string.uuid() });
    const created = await userWalletRepository.create({ userId: user.id, address: createAkashAddress() });
    const wallet = await userWalletRepository.updateById(
      created.id,
      {
        creditsLowNotifiedAt: input.creditsLowNotifiedAt ?? null,
        creditsSufficientSince: input.creditsSufficientSince ?? null,
        creditsLowSince: input.creditsLowSince ?? null
      },
      { returning: true }
    );

    return { userRepository, userWalletRepository, user, wallet };
  }
});
