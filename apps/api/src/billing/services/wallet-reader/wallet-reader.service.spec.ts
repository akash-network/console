import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
import type { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";
import { WalletReaderService } from "./wallet-reader.service";

import { createOrganizationWallet, createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(WalletReaderService.name, () => {
  describe("getWallets", () => {
    it("returns the wallet the user acts through once it is activated", async () => {
      const userId = "test-user-id";
      const activatedWallet = createUserWallet({ userId, activatedAt: new Date() });
      const { service, userWalletRepository } = setup({ wallet: activatedWallet });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([expect.objectContaining({ id: activatedWallet.id, userId, address: activatedWallet.address })]);
      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "read");
      expect(userWalletRepository.findOneUsedBy).toHaveBeenCalledWith(userId);
    });

    it("lists an organization's wallet under the user who asked for it", async () => {
      const userId = "test-user-id";
      const organizationWallet = createOrganizationWallet({ activatedAt: new Date() });
      const { service } = setup({ wallet: organizationWallet });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([expect.objectContaining({ id: organizationWallet.id, userId, address: organizationWallet.address })]);
    });

    it("returns an empty list when the user has no wallet", async () => {
      const { service } = setup({ wallet: undefined });

      const result = await service.getWallets({ userId: "test-user-id" });

      expect(result).toEqual([]);
    });

    it("excludes an activated wallet with an empty-string address", async () => {
      const userId = "test-user-id";
      const emptyAddressWallet = createUserWallet({ userId, activatedAt: new Date(), address: "" });
      const { service } = setup({ wallet: emptyAddressWallet });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([]);
    });

    it("exposes the trial window computed for the wallet", async () => {
      const userId = "test-user-id";
      const trialEndsAt = new Date("2026-09-30T00:00:00.000Z");
      const wallet = createUserWallet({ userId, activatedAt: new Date(), isTrialing: true });
      const { service, trialValidationService } = setup({ wallet, trialEndsAt, trialDurationDays: 45 });

      const result = await service.getWallets({ userId });

      expect(result[0].trialEndsAt).toEqual(trialEndsAt);
      expect(result[0].trialDurationDays).toBe(45);
      expect(trialValidationService.getTrialWindow).toHaveBeenCalledWith(wallet);
    });

    it("returns an empty list when the user only has a non-activated wallet", async () => {
      const userId = "test-user-id";
      const nonActivatedWallet = createUserWallet({ userId, activatedAt: null });
      const { service } = setup({ wallet: nonActivatedWallet });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([]);
    });
  });

  describe("getReadableWalletByUserId", () => {
    it("returns the wallet the user acts through when the caller may read it", async () => {
      const wallet = createUserWallet({ userId: "user-1" });
      const { service, userWalletRepository } = setup({ wallet });

      await expect(service.getReadableWalletByUserId("user-1")).resolves.toBe(wallet);
      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "read");
      expect(userWalletRepository.findOneUsedBy).toHaveBeenCalledWith("user-1");
    });

    it("answers 404 when there is no wallet the caller may read", async () => {
      const { service } = setup({ wallet: undefined });

      await expect(service.getReadableWalletByUserId("user-1")).rejects.toMatchObject({ status: 404, message: "UserWallet Not Found" });
    });

    it("answers 403 when the wallet has no address yet", async () => {
      const { service } = setup({ wallet: createUserWallet({ address: null }) });

      await expect(service.getReadableWalletByUserId("user-1")).rejects.toMatchObject({ status: 403, message: "UserWallet is not initialized" });
    });
  });

  describe("getWalletById", () => {
    it("returns the wallet the caller may sign with", async () => {
      const wallet = createOrganizationWallet();
      const { service, userWalletRepository } = setup({ walletById: wallet });

      await expect(service.getWalletById(wallet.id)).resolves.toBe(wallet);
      expect(userWalletRepository.accessibleBy).toHaveBeenCalledWith(expect.anything(), "sign");
      expect(userWalletRepository.findById).toHaveBeenCalledWith(wallet.id);
    });

    it("answers 404 when the caller may not sign with the wallet", async () => {
      const { service } = setup({ walletById: undefined });

      await expect(service.getWalletById(1)).rejects.toMatchObject({ status: 404, message: "UserWallet Not Found" });
    });

    it("answers 403 when the wallet has no address yet", async () => {
      const { service } = setup({ walletById: createUserWallet({ address: null }) });

      await expect(service.getWalletById(1)).rejects.toMatchObject({ status: 403, message: "UserWallet is not initialized" });
    });
  });

  function setup(input: { wallet?: UserWalletOutput; walletById?: UserWalletOutput; trialEndsAt?: Date | null; trialDurationDays?: number | null }) {
    const userWalletRepository = mock<UserWalletRepository>({
      findOneUsedBy: vi.fn().mockResolvedValue(input.wallet),
      findById: vi.fn().mockResolvedValue(input.walletById),
      toPublic: (value, trialWindow) => ({
        id: value.id,
        userId: value.userId,
        address: value.address,
        creditAmount: value.creditAmount,
        isTrialing: !!value.isTrialing,
        trialEndsAt: trialWindow?.trialEndsAt ?? null,
        trialDurationDays: trialWindow?.trialDurationDays ?? null,
        createdAt: value.createdAt
      })
    });
    userWalletRepository.accessibleBy.mockReturnValue(userWalletRepository);
    const authService = mock<AuthService>({ ability: {} });
    const trialValidationService = mock<TrialValidationService>({
      getTrialWindow: vi.fn().mockReturnValue({ trialEndsAt: input.trialEndsAt ?? null, trialDurationDays: input.trialDurationDays ?? null })
    });

    const service = new WalletReaderService(userWalletRepository, authService as AuthService, trialValidationService);

    return { service, userWalletRepository, authService, trialValidationService };
  }
});
