import assert from "http-assert";
import { singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { UserWalletRepository, type WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { StripeService } from "@src/billing/services/stripe/stripe.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { WithTransaction } from "@src/core";
import { isUniqueViolation } from "@src/core/repositories/base.repository";
import { UserOutput, UserRepository } from "@src/user/repositories";

export interface WalletSettingInput {
  autoReloadEnabled?: boolean;
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
}

@singleton()
export class WalletSettingService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly stripeService: StripeService,
    private readonly authService: AuthService,
    private readonly walletReloadJobService: WalletReloadJobService
  ) {}

  async getWalletSetting(userId: string): Promise<Omit<WalletSettingOutput, "autoReloadJobId"> | undefined> {
    const { ability } = this.authService;

    const maybeSetting = await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);

    if (!maybeSetting) {
      return undefined;
    }

    const { autoReloadJobId, ...setting } = maybeSetting;

    return setting;
  }

  @WithTransaction()
  async upsertWalletSetting(userId: UserOutput["id"], input: WalletSettingInput): Promise<Omit<WalletSettingOutput, "autoReloadJobId">> {
    let mutationResult = await this.#update(userId, input);

    if (!mutationResult.next) {
      mutationResult = await this.#create(userId, input);
    }

    await this.#arrangeSchedule(mutationResult.prev, mutationResult.next);

    const { autoReloadJobId, ...setting } = mutationResult.next!;

    return setting;
  }

  async #update(userId: UserOutput["id"], settings: WalletSettingInput): Promise<{ prev?: WalletSettingOutput; next?: WalletSettingOutput }> {
    const { ability } = this.authService;

    const prev = await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);

    if (!prev) {
      return {};
    }

    await this.#validate({ next: settings, userId });
    const next = await this.walletSettingRepository.accessibleBy(ability, "update").updateById(prev.id, settings, { returning: true });

    if (!next) {
      return {};
    }

    return { prev, next };
  }

  async #create(userId: UserOutput["id"], settings: WalletSettingInput): Promise<{ prev?: WalletSettingOutput; next: WalletSettingOutput }> {
    await this.#validate({ next: settings, userId });

    const userWallet = await this.userWalletRepository.findOneByUserId(userId);

    assert(userWallet, 404, "UserWallet Not Found");

    try {
      return {
        next: await this.walletSettingRepository.accessibleBy(this.authService.ability, "create").create({
          userId,
          walletId: userWallet.id,
          ...settings
        })
      };
    } catch (error: unknown) {
      if (isUniqueViolation(error)) {
        const updatedSettingRetried = await this.#update(userId, settings);

        assert(updatedSettingRetried.next, 500, "Failed to create a wallet setting");

        return {
          prev: updatedSettingRetried.prev,
          next: updatedSettingRetried.next
        };
      }
      throw error;
    }
  }

  async #validate({ next, userId }: { next: WalletSettingInput; userId: string }) {
    if (next.autoReloadEnabled) {
      const user = await this.userRepository.findById(userId);
      assert(user, 404, "User Not Found");

      const { stripeCustomerId } = user;
      assert(stripeCustomerId, 404, "User payments not set up");

      const { ability } = this.authService;
      assert(
        await this.stripeService.getDefaultPaymentMethod({ ...user, stripeCustomerId }, ability),
        403,
        "Default payment method is required to enable automatic wallet balance reload"
      );
    }
  }

  async #arrangeSchedule(prev?: WalletSettingOutput, next?: WalletSettingOutput) {
    if (!prev?.autoReloadEnabled && next?.autoReloadEnabled) {
      await this.walletReloadJobService.scheduleForWalletSetting(next);
    }

    if (!next?.autoReloadEnabled && next?.autoReloadJobId) {
      await this.walletReloadJobService.cancel(next.userId, next.autoReloadJobId);
    }
  }

  async deleteWalletSetting(userId: string): Promise<void> {
    const { ability } = this.authService;
    const walletSetting = await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);

    assert(walletSetting, 404, "WalletSetting Not Found");

    await Promise.all([
      this.walletSettingRepository.accessibleBy(ability, "delete").deleteBy({ userId }),
      ...(walletSetting.autoReloadJobId ? [this.walletReloadJobService.cancel(userId, walletSetting.autoReloadJobId)] : [])
    ]);
  }
}
