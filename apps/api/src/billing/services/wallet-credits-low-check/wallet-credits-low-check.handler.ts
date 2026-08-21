import { singleton } from "tsyringe";

import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { isWalletInitialized, type UserWalletOutput, UserWalletRepository, WalletSettingRepository } from "@src/billing/repositories";
import { BalancesService } from "@src/billing/services/balances/balances.service";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { type JobHandler, type JobPayload, LoggerService } from "@src/core";
import { DrainingDeploymentService } from "@src/deployment/services/draining-deployment/draining-deployment.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { creditsRunningLowNotification } from "@src/notifications/services/notification-templates/credits-running-low-notification";
import { type UserOutput, UserRepository } from "@src/user/repositories";

type SkipReason = "auto_reload_enabled" | "no_wallet" | "trialing" | "no_email" | "zero_cost" | "sufficient_balance" | "already_notified";

const UNEXPECTED_SKIP_REASONS: ReadonlySet<SkipReason> = new Set(["no_wallet", "no_email"]);

@singleton()
export class WalletCreditsLowCheckHandler implements JobHandler<WalletCreditsLowCheck> {
  public readonly accepts = WalletCreditsLowCheck;

  public readonly concurrency = 2;

  public readonly policy = "singleton";

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly userRepository: UserRepository,
    private readonly balancesService: BalancesService,
    private readonly drainingDeploymentService: DrainingDeploymentService,
    private readonly notificationService: NotificationService,
    private readonly billingConfig: BillingConfigService,
    private readonly logger: LoggerService
  ) {}

  async handle(payload: JobPayload<WalletCreditsLowCheck>): Promise<void> {
    const resources = await this.#getValidWalletResources(payload.userId);
    if (!resources) {
      return;
    }

    const { wallet, user } = resources;
    const balanceUsd = await this.balancesService.getDeploymentBalanceInFiat(wallet.address);
    const weeklyCostUsd = await this.drainingDeploymentService.calculateWeeklyDeploymentCostForAddress(wallet.address);

    if (weeklyCostUsd === 0) {
      await this.#clearNotifiedIfSet(wallet);
      this.#skip("zero_cost", payload.userId);
      return;
    }

    if (balanceUsd >= weeklyCostUsd) {
      await this.#clearNotifiedIfSet(wallet);
      this.#skip("sufficient_balance", payload.userId);
      return;
    }

    if (wallet.creditsLowNotifiedAt) {
      this.#skip("already_notified", payload.userId);
      return;
    }

    const paymentLink = this.billingConfig.get("CONSOLE_WEB_PAYMENT_LINK");
    const daysRemaining = Math.max(0, Math.floor(balanceUsd / (weeklyCostUsd / 7)));

    await this.notificationService.createNotification(
      creditsRunningLowNotification(user, {
        balanceUsd,
        weeklyCostUsd,
        daysRemaining,
        paymentLink,
        billingUrl: paymentLink.split("?")[0]
      })
    );

    await this.userWalletRepository.updateById(wallet.id, { creditsLowNotifiedAt: new Date() });

    this.logger.info({
      event: "CREDITS_LOW_EMAIL_SENT",
      userId: payload.userId,
      balanceUsd,
      weeklyCostUsd,
      daysRemaining
    });
  }

  async #getValidWalletResources(userId: UserOutput["id"]) {
    const walletSetting = await this.walletSettingRepository.findByUserId(userId);
    if (walletSetting?.autoReloadEnabled) {
      this.#skip("auto_reload_enabled", userId);
      return;
    }

    const wallet = await this.userWalletRepository.findOneByUserId(userId);
    if (!wallet || !isWalletInitialized(wallet)) {
      this.#skip("no_wallet", userId);
      return;
    }

    if (wallet.isTrialing) {
      this.#skip("trialing", userId);
      return;
    }

    const user = await this.userRepository.findById(userId);
    if (!user?.email) {
      this.#skip("no_email", userId);
      return;
    }

    return { wallet, user };
  }

  async #clearNotifiedIfSet(wallet: UserWalletOutput): Promise<void> {
    if (!wallet.creditsLowNotifiedAt) {
      return;
    }

    await this.userWalletRepository.updateById(wallet.id, { creditsLowNotifiedAt: null });
  }

  #skip(reason: SkipReason, userId: UserOutput["id"]): void {
    const payload = {
      event: "CREDITS_LOW_CHECK_SKIPPED",
      userId,
      reason
    };

    if (UNEXPECTED_SKIP_REASONS.has(reason)) {
      this.logger.warn(payload);
      return;
    }

    this.logger.info(payload);
  }
}
