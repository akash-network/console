import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import type { UserRepository } from "@src/user/repositories";
import { CreditsWarningRecipientService } from "./credits-warning-recipient.service";

import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";
import { generateWalletSetting } from "@test/seeders/wallet-setting.seeder";

describe(CreditsWarningRecipientService.name, () => {
  it("returns the wallet and user of a paying user with Auto Recharge off", async () => {
    const { service, user, wallet } = setup();

    const result = await service.find(user.id);

    expect(result.unwrap()).toEqual({ wallet, user });
  });

  it("returns a user who has no wallet setting at all", async () => {
    const { service, user, wallet } = setup({ walletSettingNotFound: true });

    const result = await service.find(user.id);

    expect(result.unwrap()).toEqual({ wallet, user });
  });

  it("returns a user whose Auto Recharge is paused after repeated declines", async () => {
    const { service, user, wallet } = setup({ autoReloadEnabled: true, autoReloadPausedAt: new Date() });

    const result = await service.find(user.id);

    expect(result.unwrap()).toEqual({ wallet, user });
  });

  it("refuses a user whose Auto Recharge refills the balance, before reading their wallet", async () => {
    const { service, user, userWalletRepository } = setup({ autoReloadEnabled: true });

    const result = await service.find(user.id);

    expect(result.val).toBe("auto_reload_enabled");
    expect(userWalletRepository.findOneByUserId).not.toHaveBeenCalled();
  });

  it("refuses a user without a wallet", async () => {
    const { service, user } = setup({ walletNotFound: true });

    const result = await service.find(user.id);

    expect(result.val).toBe("no_wallet");
  });

  it("refuses a user whose wallet has no address yet", async () => {
    const { service, user } = setup({ address: null });

    const result = await service.find(user.id);

    expect(result.val).toBe("no_wallet");
  });

  it("refuses a trialing user", async () => {
    const { service, user } = setup({ isTrialing: true });

    const result = await service.find(user.id);

    expect(result.val).toBe("trialing");
  });

  it("refuses a user whose wallet is locked for abuse, before reading the user", async () => {
    const { service, user, userRepository } = setup({ abuseLockedAt: new Date() });

    const result = await service.find(user.id);

    expect(result.val).toBe("abuse_locked");
    expect(userRepository.findById).not.toHaveBeenCalled();
  });

  it("refuses a user without an email address", async () => {
    const { service, user } = setup({ email: null });

    const result = await service.find(user.id);

    expect(result.val).toBe("no_email");
  });

  it("refuses a user the user table no longer has", async () => {
    const { service, user } = setup({ userNotFound: true });

    const result = await service.find(user.id);

    expect(result.val).toBe("no_email");
  });

  function setup(input?: {
    autoReloadEnabled?: boolean;
    autoReloadPausedAt?: Date;
    walletSettingNotFound?: boolean;
    walletNotFound?: boolean;
    address?: string | null;
    isTrialing?: boolean;
    abuseLockedAt?: Date;
    email?: string | null;
    userNotFound?: boolean;
  }) {
    const user = createUser({ email: input?.email === undefined ? "user@example.com" : input.email });
    const wallet = createUserWallet({
      userId: user.id,
      isTrialing: input?.isTrialing ?? false,
      abuseLockedAt: input?.abuseLockedAt ?? null,
      ...(input?.address !== undefined && { address: input.address })
    });
    const walletSetting = generateWalletSetting({
      userId: user.id,
      walletId: wallet.id,
      autoReloadEnabled: input?.autoReloadEnabled ?? false,
      autoReloadPausedAt: input?.autoReloadPausedAt ?? null
    });

    const walletSettingRepository = mock<WalletSettingRepository>();
    walletSettingRepository.findByUserId.mockResolvedValue(input?.walletSettingNotFound ? undefined : walletSetting);
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findOneByUserId.mockResolvedValue(input?.walletNotFound ? undefined : wallet);
    const userRepository = mock<UserRepository>();
    userRepository.findById.mockResolvedValue(input?.userNotFound ? undefined : user);

    const service = new CreditsWarningRecipientService(walletSettingRepository, userWalletRepository, userRepository);

    return { service, user, wallet, walletSettingRepository, userWalletRepository, userRepository };
  }
});
