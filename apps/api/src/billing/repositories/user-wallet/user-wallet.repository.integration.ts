import { faker } from "@faker-js/faker";
import subDays from "date-fns/subDays";
import subMinutes from "date-fns/subMinutes";
import { container } from "tsyringe";
import { describe, expect, it } from "vitest";

import { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import { UserRepository } from "@src/user/repositories";
import { UserWalletRepository } from "./user-wallet.repository";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const RECOVERY_WINDOWS = { confirmWindowMinutes: 30, resendCooldownHours: 168 };

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
        creditsLowNotifiedAt: subDays(new Date(), 8),
        creditsSufficientSince: subMinutes(new Date(), 31),
        creditsLowSince: subMinutes(new Date(), 120)
      });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, RECOVERY_WINDOWS);

      const updated = await userWalletRepository.findById(wallet.id);
      expect(isCleared).toBe(true);
      expect(updated?.creditsLowNotifiedAt).toBeNull();
      expect(updated?.creditsSufficientSince).toBeNull();
      expect(updated?.creditsLowSince).toBeNull();
    });

    it("keeps the notified stamp while the email went out inside the resend cooldown", async () => {
      const creditsLowNotifiedAt = subMinutes(new Date(), 90);
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt,
        creditsSufficientSince: subMinutes(new Date(), 31)
      });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, RECOVERY_WINDOWS);

      const updated = await userWalletRepository.findById(wallet.id);
      expect(isCleared).toBe(false);
      expect(updated?.creditsLowNotifiedAt).toEqual(creditsLowNotifiedAt);
    });

    it("keeps the notified stamp while the window has not elapsed", async () => {
      const creditsLowNotifiedAt = subDays(new Date(), 8);
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt,
        creditsSufficientSince: subMinutes(new Date(), 5)
      });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, RECOVERY_WINDOWS);

      const updated = await userWalletRepository.findById(wallet.id);
      expect(isCleared).toBe(false);
      expect(updated?.creditsLowNotifiedAt).toEqual(creditsLowNotifiedAt);
    });

    it("keeps the notified stamp when no recovery has been recorded", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsLowNotifiedAt: subMinutes(new Date(), 90) });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, RECOVERY_WINDOWS);

      expect(isCleared).toBe(false);
    });

    it("reports no clear when the wallet was never notified", async () => {
      const { userWalletRepository, wallet } = await setup({ creditsSufficientSince: subMinutes(new Date(), 90) });

      const isCleared = await userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, RECOVERY_WINDOWS);

      expect(isCleared).toBe(false);
    });

    it("clears exactly once across concurrent attempts", async () => {
      const { userWalletRepository, wallet } = await setup({
        creditsLowNotifiedAt: subDays(new Date(), 8),
        creditsSufficientSince: subMinutes(new Date(), 31)
      });

      const results = await Promise.all(
        Array.from({ length: 5 }, () => userWalletRepository.clearCreditsLowNotifiedIfRecoveryConfirmed(wallet.id, RECOVERY_WINDOWS))
      );

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

  describe("lockForAbuse", () => {
    it("zeroes both allowances, ends the trial and stamps the lock in one write", async () => {
      const { userWalletRepository, wallet } = await setup();
      await userWalletRepository.updateById(wallet.id, { deploymentAllowance: 1_000_000, feeAllowance: 500_000, isTrialing: true });

      await userWalletRepository.lockForAbuse(wallet.id, "workload_abuse");

      const locked = await userWalletRepository.findById(wallet.id);
      expect(locked).toMatchObject({ deploymentAllowance: 0, feeAllowance: 0, isTrialing: false, abuseLockedReason: "workload_abuse" });
      expect(locked?.abuseLockedAt).toBeInstanceOf(Date);
    });
  });

  describe("clearAbuseLock", () => {
    it("removes the lock and its reason without touching the allowances", async () => {
      const { userWalletRepository, wallet } = await setup();
      await userWalletRepository.lockForAbuse(wallet.id, "workload_abuse");

      await expect(userWalletRepository.clearAbuseLock(wallet.id)).resolves.toBe(true);

      expect(await userWalletRepository.findById(wallet.id)).toMatchObject({
        abuseLockedAt: null,
        abuseLockedReason: null,
        deploymentAllowance: 0,
        feeAllowance: 0,
        isTrialing: false
      });
    });

    it("reports no clear for a wallet that holds no lock", async () => {
      const { userWalletRepository, wallet } = await setup();

      await expect(userWalletRepository.clearAbuseLock(wallet.id)).resolves.toBe(false);
    });
  });

  describe("findDrainingWallets", () => {
    it("leaves a wallet locked for abuse out of the fee refill", async () => {
      const { userWalletRepository, wallet } = await setup();
      const { wallet: lockedWallet } = await setup();
      await userWalletRepository.updateById(wallet.id, { activatedAt: new Date(), feeAllowance: 0, isTrialing: false });
      await userWalletRepository.updateById(lockedWallet.id, { activatedAt: new Date(), feeAllowance: 0, isTrialing: false });
      await userWalletRepository.lockForAbuse(lockedWallet.id, "workload_abuse");

      const draining = await userWalletRepository.findDrainingWallets({ fee: 1_000, trialExpirationDays: 30 });

      const ids = draining.map(candidate => candidate.id);
      expect(ids).toContain(wallet.id);
      expect(ids).not.toContain(lockedWallet.id);
    });
  });

  describe("findLockableTrialWalletsByEmailDomain", () => {
    it("returns the trialing, unlocked, never-paid wallets on the domain", async () => {
      const { domain, createWalletOnDomain, userWalletRepository } = await setupDomain();
      const target = await createWalletOnDomain({});
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 10 });

      expect(lockable).toEqual([{ walletId: target.id, userId: target.userId }]);
    });

    it.each([
      { label: "already locked", overrides: { abuseLockedAt: new Date(), abuseLockedReason: "workload_abuse" } },
      { label: "no longer trialing", overrides: { isTrialing: false } }
    ])("excludes a wallet that is $label", async ({ overrides }) => {
      const { domain, createWalletOnDomain, userWalletRepository } = await setupDomain();
      await createWalletOnDomain(overrides);
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 10 });

      expect(lockable).toEqual([]);
    });

    it("excludes a wallet whose owner has ever paid", async () => {
      const { domain, createWalletOnDomain, userWalletRepository, stripeTransactionRepository } = await setupDomain();
      const paid = await createWalletOnDomain({});
      await stripeTransactionRepository.create({ userId: paid.userId, type: "payment_intent", status: "succeeded", amount: 1000, currency: "usd" });
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 10 });

      expect(lockable).toEqual([]);
    });

    it("still returns a wallet whose owner only ever received a manual credit", async () => {
      const { domain, createWalletOnDomain, userWalletRepository, stripeTransactionRepository } = await setupDomain();
      const comped = await createWalletOnDomain({});
      await stripeTransactionRepository.create({ userId: comped.userId, type: "manual_credit", status: "succeeded", amount: 1000, currency: "usd" });
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 10 });

      expect(lockable).toEqual([{ walletId: comped.id, userId: comped.userId }]);
    });

    it("excludes the wallet that triggered the block", async () => {
      const { domain, createWalletOnDomain, userWalletRepository } = await setupDomain();
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 10 });

      expect(lockable).toEqual([]);
    });

    it("matches the domain part only, never a domain that merely contains it", async () => {
      const { domain, createWalletOnDomain, userWalletRepository } = await setupDomain();
      await createWalletOnDomain({}, `x${domain}`);
      await createWalletOnDomain({}, `${domain}.attacker.net`);
      await createWalletOnDomain({}, `mail.${domain}`);
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 10 });

      expect(lockable).toEqual([]);
    });

    it("returns no more wallets than the limit allows", async () => {
      const { domain, createWalletOnDomain, userWalletRepository } = await setupDomain();
      await createWalletOnDomain({});
      await createWalletOnDomain({});
      await createWalletOnDomain({});
      const trigger = await createWalletOnDomain({});

      const lockable = await userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: trigger.id, limit: 2 });

      expect(lockable).toHaveLength(2);
    });
  });

  async function setupDomain() {
    const userRepository = container.resolve(UserRepository);
    const userWalletRepository = container.resolve(UserWalletRepository);
    const stripeTransactionRepository = container.resolve(StripeTransactionRepository);
    const domain = `${faker.string.alphanumeric(16).toLowerCase()}.com`;

    async function createWalletOnDomain(overrides: Parameters<UserWalletRepository["updateById"]>[1], onDomain = domain) {
      const user = await userRepository.create({ userId: faker.string.uuid(), email: `${faker.string.alphanumeric(10)}@${onDomain}` });
      const created = await userWalletRepository.create({ userId: user.id, address: createAkashAddress() });
      return await userWalletRepository.updateById(created.id, { isTrialing: true, abuseLockedAt: null, ...overrides }, { returning: true });
    }

    return { domain, createWalletOnDomain, userRepository, userWalletRepository, stripeTransactionRepository };
  }

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
