import assert from "http-assert";
import { Lifecycle, scoped } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletOutput, UserWalletPublicOutput, UserWalletRepository } from "@src/billing/repositories";

export interface GetWalletOptions {
  userId: string;
}

export type WalletInitialized = Omit<UserWalletOutput, "address"> & { address: string };

@scoped(Lifecycle.ResolutionScoped)
export class WalletReaderService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  async getWallets(query: GetWalletOptions): Promise<UserWalletPublicOutput[]> {
    const wallets = await this.userWalletRepository.accessibleBy(this.authService.ability, "read").find(query);

    return wallets.map(wallet => this.userWalletRepository.toPublic(wallet));
  }

  async getWalletByUserId(userId: string): Promise<WalletInitialized>;
  async getWalletByUserId(userId: string, options: { isInitialised: true }): Promise<UserWalletOutput>;
  async getWalletByUserId(userId: string, options?: { isInitialised: boolean }): Promise<UserWalletOutput | WalletInitialized> {
    const { ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(userId);
    assert(userWallet, 404, "UserWallet Not Found");

    if (options?.isInitialised) {
      return userWallet;
    }

    const { address } = userWallet;
    assert(address, 403, "UserWallet is not initialized");

    return {
      ...userWallet,
      address
    };
  }
}
