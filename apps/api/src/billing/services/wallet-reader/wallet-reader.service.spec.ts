import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AuthService } from "@src/auth/services/auth.service";
import type { UserWalletOutput, UserWalletRepository } from "@src/billing/repositories";
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

    it("returns an empty list when the user only has a non-activated wallet", async () => {
      const userId = "test-user-id";
      const nonActivatedWallet = createUserWallet({ userId, activatedAt: null });
      const { service } = setup({ wallets: [nonActivatedWallet] });

      const result = await service.getWallets({ userId });

      expect(result).toEqual([]);
    });
  });

  function setup(input: { wallets: UserWalletOutput[] }) {
    const userWalletRepository = mock<UserWalletRepository>({
      find: vi.fn().mockResolvedValue(input.wallets),
      accessibleBy() {
        return this as unknown as UserWalletRepository;
      },
      toPublic: value => ({
        id: value.id,
        userId: value.userId,
        address: value.address,
        creditAmount: value.creditAmount,
        isTrialing: !!value.isTrialing,
        createdAt: value.createdAt
      })
    }) as unknown as UserWalletRepository;
    const authService = mock<AuthService>({ ability: {} });

    const service = new WalletReaderService(userWalletRepository, authService as AuthService);

    return { service, userWalletRepository, authService };
  }
});
