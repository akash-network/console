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
import { TrialValidationService } from "@src/billing/services/trial-validation/trial-validation.service";

export interface GetWalletOptions {
  userId: string;
}

@scoped(Lifecycle.ResolutionScoped)
export class WalletReaderService {
  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly trialValidationService: TrialValidationService
  ) {}

  /** An organization's wallet is listed under the user who asked for it, since it belongs to no user. */
  async getWallets(query: GetWalletOptions): Promise<UserWalletPublicOutput[]> {
    const wallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "read").findOneUsedBy(query.userId);

    if (!wallet?.activatedAt || !isWalletInitialized(wallet)) return [];

    return [this.userWalletRepository.toPublic({ ...wallet, userId: wallet.userId ?? query.userId }, this.trialValidationService.getTrialWindow(wallet))];
  }

  async getWalletByUserId(userId: string): Promise<WalletInitialized>;
  async getWalletByUserId(userId: string, options: { isInitialised: true }): Promise<UserWalletOutput>;
  @Trace()
  async getWalletByUserId(userId: string, options?: { isInitialised: boolean }): Promise<UserWalletOutput | WalletInitialized> {
    const { ability } = this.authService;

    const userWallet = await this.userWalletRepository.accessibleBy(ability, "sign").findOneUsedBy(userId);
    assert(userWallet, 404, "UserWallet Not Found");

    if (options?.isInitialised) {
      return userWallet;
    }

    assert(isWalletInitialized(userWallet), 403, "UserWallet is not initialized");

    return userWallet;
  }

  async getWalletById(walletId: number): Promise<WalletInitialized> {
    const userWallet = await this.userWalletRepository.accessibleBy(this.authService.ability, "sign").findById(walletId);
    assert(userWallet, 404, "UserWallet Not Found");
    assert(isWalletInitialized(userWallet), 403, "UserWallet is not initialized");

    return userWallet;
  }
}
