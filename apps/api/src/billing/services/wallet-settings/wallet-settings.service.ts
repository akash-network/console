import assert from "http-assert";
import { inject, singleton } from "tsyringe";

import { AuthService } from "@src/auth/services/auth.service";
import { isAutoReloadActive } from "@src/billing/lib/auto-reload/auto-reload";
import { centsToUsd, usdToCents } from "@src/billing/lib/currency/currency";
import { organizationAnalyticsProperties } from "@src/billing/lib/organization-analytics/organization-analytics";
import { UserWalletRepository, type WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { PayerService } from "@src/billing/services/payer/payer.service";
import { PaymentMethodService } from "@src/billing/services/payment-method/payment-method.service";
import { WalletReloadJobService } from "@src/billing/services/wallet-reload-job/wallet-reload-job.service";
import { TxService } from "@src/core";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { UserOutput } from "@src/user/repositories";

/**
 * Saving auto top-up settings is the user asking us to try the card again, so it lifts a pause left
 * by repeated declines. Clearing the charge marker too is what lets the next check charge straight
 * away rather than waiting out the cooldown the declining card consumed.
 */
function liftDeclinePause(prev: WalletSettingOutput) {
  return prev.autoReloadPausedAt ? { autoReloadFailureCount: 0, autoReloadPausedAt: null, lastAutoChargeAt: null } : {};
}

export interface WalletSettingInput {
  autoReloadEnabled?: boolean;
  autoReloadMode?: WalletSettingOutput["autoReloadMode"];
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
}

@singleton()
export class WalletSettingService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly payerService: PayerService,
    private readonly paymentMethodService: PaymentMethodService,
    private readonly authService: AuthService,
    private readonly walletReloadJobService: WalletReloadJobService,
    private readonly analyticsService: AnalyticsService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: WalletSettingService.name });
  }

  async getWalletSetting(userId: string): Promise<WalletSettingOutput | undefined> {
    const setting = await this.#findSettingOfWalletUsedBy(userId, "read");

    return setting && this.#toDomainSetting(setting);
  }

  /** The setting of the wallet the user acts through: the active team's, or the user's own. */
  async #findSettingOfWalletUsedBy(userId: UserOutput["id"], action: "read" | "update") {
    const wallet = await this.userWalletRepository.findOneUsedBy(userId);

    return wallet && (await this.walletSettingRepository.accessibleBy(this.authService.ability, action).findOneBy({ walletId: wallet.id }));
  }

  /** Validates before the transaction opens, so the Stripe lookup never holds a connection or the row lock that auto-charge claims wait on. */
  async upsertWalletSetting(userId: UserOutput["id"], input: WalletSettingInput): Promise<WalletSettingOutput> {
    await this.#validate({ next: input });

    return await this.txService.transaction(() => this.#saveWalletSetting(userId, input));
  }

  async #saveWalletSetting(userId: UserOutput["id"], input: WalletSettingInput): Promise<WalletSettingOutput> {
    let mutationResult = await this.#update(userId, input);

    if (!mutationResult.next) {
      mutationResult = await this.#create(userId, input);
    }

    await this.#arrangeSchedule(mutationResult.prev, mutationResult.next);
    await this.#trackAutoReloadToggle(userId, mutationResult.prev, mutationResult.next!);

    return this.#toDomainSetting(mutationResult.next!);
  }

  async disableAutoReload(userId: UserOutput["id"]): Promise<void> {
    const { ability } = this.authService;
    const setting = await this.#findSettingOfWalletUsedBy(userId, "read");

    if (!setting?.autoReloadEnabled) {
      return;
    }

    const target = await this.walletReloadJobService.targetOf(setting);
    await this.walletSettingRepository.accessibleBy(ability, "update").updateById(setting.id, { autoReloadEnabled: false });
    await this.walletReloadJobService.cancelReloadCheck(target);
    await this.walletReloadJobService.scheduleCreditsLowCheck(target, { withCleanup: true });
    this.logger.info({ event: "AUTO_RELOAD_DISABLED", reason: "DEFAULT_PAYMENT_METHOD_REMOVED", userId });
    this.analyticsService.track(userId, "auto_recharge_disabled", {
      disabled_by: "console",
      reason: "default_payment_method_removed",
      ...(await this.#payingOrganizationProperties())
    });
  }

  async #trackAutoReloadToggle(userId: UserOutput["id"], prev: WalletSettingOutput | undefined, next: WalletSettingOutput) {
    if (Boolean(prev?.autoReloadEnabled) === next.autoReloadEnabled) {
      return;
    }

    const organization = await this.#payingOrganizationProperties();

    if (!next.autoReloadEnabled) {
      this.analyticsService.track(userId, "auto_recharge_disabled", { disabled_by: "user", ...organization });
      return;
    }

    this.analyticsService.track(userId, "auto_recharge_enabled", {
      ...organization,
      mode: next.autoReloadMode,
      ...(next.autoReloadMode === "threshold" && {
        threshold_usd: centsToUsd(next.autoReloadThreshold),
        amount_usd: centsToUsd(next.autoReloadAmount)
      })
    });
  }

  /** Holds the setting row until the save commits, so an overlapping save waits and compares against this one's result. */
  async #update(userId: UserOutput["id"], settings: WalletSettingInput): Promise<{ prev?: WalletSettingOutput; next?: WalletSettingOutput }> {
    const { ability } = this.authService;

    const wallet = await this.userWalletRepository.findOneUsedBy(userId);
    const prev = wallet && (await this.walletSettingRepository.accessibleBy(ability, "read").findOneByAndLock({ walletId: wallet.id }));

    if (!prev) {
      return {};
    }

    const next = await this.walletSettingRepository
      .accessibleBy(ability, "update")
      .updateById(prev.id, { ...this.#toStoredSettings(settings), ...liftDeclinePause(prev) }, { returning: true });

    if (!next) {
      return {};
    }

    return { prev, next };
  }

  async #create(userId: UserOutput["id"], settings: WalletSettingInput): Promise<{ prev?: WalletSettingOutput; next: WalletSettingOutput }> {
    const userWallet = await this.userWalletRepository.findOneUsedBy(userId);

    assert(userWallet, 404, "UserWallet Not Found");

    const created = await this.walletSettingRepository.accessibleBy(this.authService.ability, "create").createUnlessExists({
      userId,
      walletId: userWallet.id,
      ...this.#toStoredSettings(settings)
    });

    if (created) {
      return { next: created };
    }

    const updatedSettingRetried = await this.#update(userId, settings);

    assert(updatedSettingRetried.next, 500, "Failed to create a wallet setting");

    return {
      prev: updatedSettingRetried.prev,
      next: updatedSettingRetried.next
    };
  }

  /** The active organization pays for the auto reload, so its customer must hold the default card. */
  async #validate({ next }: { next: WalletSettingInput }) {
    if (next.autoReloadEnabled) {
      const payer = await this.payerService.getCurrentPayer();
      const { stripeCustomerId } = payer;
      assert(stripeCustomerId, 404, payer.team ? "Organization payments are not set up." : "User payments not set up");

      const { ability } = this.authService;
      assert(
        await this.paymentMethodService.getDefaultPaymentMethod({ ...payer, stripeCustomerId }, ability),
        403,
        "Default payment method is required to enable automatic wallet balance reload"
      );
    }
  }

  async #arrangeSchedule(prev?: WalletSettingOutput, next?: WalletSettingOutput) {
    if (!next) {
      return;
    }

    if (next.autoReloadEnabled) {
      if (!isAutoReloadActive(prev)) {
        await this.walletReloadJobService.scheduleForWalletSetting(next, { withCleanup: true });
        await this.walletReloadJobService.cancelCreditsLowCheck(await this.walletReloadJobService.targetOf(next));
        await this.userWalletRepository.updateById(next.walletId, { creditsLowNotifiedAt: null, creditsSufficientSince: null, creditsLowSince: null });
        return;
      }

      if (this.#hasReloadRuleChanged(prev, next)) {
        await this.walletReloadJobService.scheduleForWalletSetting(next, { withCleanup: true });
      }
      return;
    }

    if (prev?.autoReloadEnabled) {
      await this.walletReloadJobService.scheduleCreditsLowCheck(await this.walletReloadJobService.targetOf(next), { withCleanup: true });
    }
  }

  async #payingOrganizationProperties() {
    const payer = await this.payerService.getCurrentPayer();

    return organizationAnalyticsProperties({ id: payer.organizationId, type: payer.team ? "team" : "personal" });
  }

  #hasReloadRuleChanged(prev: WalletSettingOutput, next: WalletSettingOutput) {
    return (
      prev.autoReloadMode !== next.autoReloadMode || prev.autoReloadThreshold !== next.autoReloadThreshold || prev.autoReloadAmount !== next.autoReloadAmount
    );
  }

  #toStoredSettings(settings: WalletSettingInput): WalletSettingInput {
    return {
      ...settings,
      ...(settings.autoReloadThreshold !== undefined && { autoReloadThreshold: usdToCents(settings.autoReloadThreshold) }),
      ...(settings.autoReloadAmount !== undefined && { autoReloadAmount: usdToCents(settings.autoReloadAmount) })
    };
  }

  #toDomainSetting(setting: WalletSettingOutput): WalletSettingOutput {
    return {
      ...setting,
      autoReloadThreshold: centsToUsd(setting.autoReloadThreshold),
      autoReloadAmount: centsToUsd(setting.autoReloadAmount)
    };
  }

  async deleteWalletSetting(userId: string): Promise<void> {
    const walletSetting = await this.#findSettingOfWalletUsedBy(userId, "read");

    assert(walletSetting, 404, "WalletSetting Not Found");

    await this.walletSettingRepository.accessibleBy(this.authService.ability, "delete").deleteBy({ id: walletSetting.id });
  }
}
