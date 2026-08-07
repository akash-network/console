import { Trace } from "@akashnetwork/instrumentation";
import assert from "http-assert";
import { Lifecycle, scoped } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import {
  isWalletInitialized,
  type UserWalletOutput,
  type UserWalletPublicOutput,
  UserWalletRepository,
  type WalletInitialized
} from "@src/billing/repositories";

export interface GetWalletOptions {
  userId: string;
}

@scoped(Lifecycle.ResolutionScoped)
export class WalletReaderService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService
  ) {}

  async getWallets(query: GetWalletOptions): Promise<UserWalletPublicOutput[]> {
    const wallets = await this.userWalletRepository.accessibleBy(this.authService.ability, "read").find(query);

    return wallets
      .filter((wallet): wallet is WalletInitialized => wallet.activatedAt !== null && isWalletInitialized(wallet))
      .map(wallet => this.userWalletRepository.toPublic(wallet));
  }

  async getWalletByUserId(userId: string): Promise<WalletInitialized>;
  async getWalletByUserId(userId: string, options: { isInitialised: true }): Promise<UserWalletOutput>;
  @Trace()
  async getWalletByUserId(userId: string, options?: { isInitialised: boolean }): Promise<UserWalletOutput | WalletInitialized> {
    const { ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneByUserId(userId);
    assert(userWallet, 404, "UserWallet Not Found");

    if (options?.isInitialised) {
      return userWallet;
    }

    assert(isWalletInitialized(userWallet), 403, "UserWallet is not initialized");

    return userWallet;
  }
}
