import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { WalletReaderService } from "./wallet-reader.service";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletReaderService.name, () => {
  describe("getWallets", () => {
    it("returns only activated wallets", async () => {
      const userId = "test-user-id";
      const activatedWallet = createUserWallet({ userId, activatedAt: new Date() });
      const nonActivatedWallet = createUserWallet({ userId, activatedAt: null });
      const { service } = setup({ wallets: [activatedWallet, nonActivatedWallet] });

      const result = await service.getWallets({ userId });

      expect(result).toHaveLength(1);
      expect(result[0].address).toBe(activatedWallet.address);
    });

    it("excludes activated wallets with an empty-string address", async () => {
      const userId = "test-user-id";
      const emptyAddressWallet = createUserWallet({ userId, activatedAt: new Date(), address: "" });
      const { service } = setup({ wallets: [emptyAddressWallet] });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([]);
    });

    it("exposes the trial expiry computed for the wallet", async () => {
      const userId = "test-user-id";
      const trialEndsAt = new Date("2026-09-30T00:00:00.000Z");
      const wallet = createUserWallet({ userId, activatedAt: new Date(), isTrialing: true });
      const { service, trialValidationService } = setup({ wallets: [wallet], trialEndsAt });

      const result = await service.getWallets({ userId });

      expect(result[0].trialEndsAt).toEqual(trialEndsAt);
      expect(trialValidationService.getTrialEndsAt).toHaveBeenCalledWith(wallet);
    });

    it("returns an empty list when the user only has a non-activated wallet", async () => {
      const userId = "test-user-id";
      const nonActivatedWallet = createUserWallet({ userId, activatedAt: null });
      const { service } = setup({ wallets: [nonActivatedWallet] });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([]);
    });
  });

  function setup(input: { wallets: UserWalletOutput[]; trialEndsAt?: Date | null }) {
    const userWalletRepository = mock<UserWalletRepository>({
      find: vi.fn().mockResolvedValue(input.wallets),
      accessibleBy() {
        return this as unknown as UserWalletRepository;
      },
      toPublic: (value, options) => ({
        id: value.id,
        userId: value.userId,
        address: value.address,
        creditAmount: value.creditAmount,
        isTrialing: !!value.isTrialing,
        trialEndsAt: options?.trialEndsAt ?? null,
        createdAt: value.createdAt
      })
    }) as unknown as UserWalletRepository;
    const authService = mock<AuthService>({ ability: {} });
    const trialValidationService = mock<TrialValidationService>({
      getTrialEndsAt: vi.fn().mockReturnValue(input.trialEndsAt ?? null)
    });

    const service = new WalletReaderService(userWalletRepository, authService as AuthService, trialValidationService);

    return { service, userWalletRepository, authService, trialValidationService };
  }
});
