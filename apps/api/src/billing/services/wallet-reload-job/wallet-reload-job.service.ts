import { addMilliseconds, millisecondsInMinute } from "date-fns";
import { inject, singleton } from "tsyringe";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletCreditsExhaustedCheck } from "@src/billing/events/wallet-credits-exhausted-check";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { isAutoReloadActive } from "@src/billing/lib/auto-reload/auto-reload";
import { calculateChargeCooldownMinutes } from "@src/billing/lib/auto-reload/charge-cooldown";
import {
  pickWalletBillingTarget,
  singletonKeyOf,
  type WalletBillingTarget,
  walletBillingTargetOf
} from "@src/billing/lib/wallet-billing-target/wallet-billing-target";
import { UserWalletRepository, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { EnqueueOptions, JobQueueService } from "@src/core";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";

/** Landing slightly past the reopen keeps the deferred check from losing the claim on the boundary and deferring again. */
const CHARGE_WINDOW_REOPEN_BUFFER_IN_MS = millisecondsInMinute;

@singleton()
export class WalletReloadJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly billingConfig: BillingConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: WalletReloadJobService.name });
  }

  /** Deliberately does not fall through to a credits-low check: this runs on every managed spend, which CON-896 moved off that path. */
  async scheduleImmediate(input: WalletReloadImmediateInput, options?: { triggeredByDeployment?: boolean }): Promise<boolean> {
    const walletSetting =
      "userId" in input
        ? await this.walletSettingRepository.findByUserId(input.userId)
        : await this.walletSettingRepository.findOneBy({ walletId: input.walletId });

    if (isAutoReloadActive(walletSetting)) {
      const startAfter = this.#chargeWindowReopenAfter(walletSetting);
      await this.scheduleForWalletSetting(walletSetting, {
        withCleanup: true,
        startAfter,
        triggeredByDeployment: startAfter ? undefined : options?.triggeredByDeployment
      });
      return true;
    }

    return false;
  }

  /** A check inside the cooldown can only defer to the reopen, so it is queued there directly; the deployment flag vouches for a create that just happened and is dropped on the way. */
  #chargeWindowReopenAfter(walletSetting: Pick<WalletSettingOutput, "lastAutoChargeAt" | "autoReloadFailureCount">): string | undefined {
    const cooldownMinutes = calculateChargeCooldownMinutes(
      {
        baseMinutes: this.billingConfig.get("AUTO_RELOAD_CHARGE_COOLDOWN_IN_MIN"),
        maxMinutes: this.billingConfig.get("AUTO_RELOAD_CHARGE_BACKOFF_MAX_IN_MIN")
      },
      walletSetting.autoReloadFailureCount
    );

    if (!walletSetting.lastAutoChargeAt || cooldownMinutes === 0) {
      return undefined;
    }

    const reopenAt = addMilliseconds(walletSetting.lastAutoChargeAt, cooldownMinutes * millisecondsInMinute + CHARGE_WINDOW_REOPEN_BUFFER_IN_MS);

    return reopenAt > new Date() ? reopenAt.toISOString() : undefined;
  }

  async scheduleCreditsLowCheckIfAutoReloadOff(input: { walletId: number }): Promise<void> {
    const walletSetting = await this.walletSettingRepository.findOneBy({ walletId: input.walletId });

    if (isAutoReloadActive(walletSetting)) {
      return;
    }

    const wallet = await this.userWalletRepository.findOneBy({ id: input.walletId });
    if (!wallet) {
      return;
    }

    await this.scheduleCreditsLowCheck(walletBillingTargetOf(wallet), { withCleanup: true });
  }

  /** A setting saved for a team's wallet keeps the member who saved it, or nobody once that member's account is deleted, so whose wallet it is comes from the wallet. */
  async targetOf(walletSetting: Pick<WalletSettingOutput, "walletId" | "userId">): Promise<WalletBillingTarget> {
    const wallet = await this.userWalletRepository.findOneBy({ id: walletSetting.walletId });

    return (wallet && !wallet.userId) || !walletSetting.userId ? { walletId: walletSetting.walletId } : { userId: walletSetting.userId };
  }

  async scheduleForWalletSetting(
    walletSetting: Pick<WalletSettingOutput, "id" | "walletId" | "userId">,
    options?: Pick<EnqueueOptions, "startAfter"> & { withCleanup?: boolean; triggeredByDeployment?: boolean }
  ): Promise<string> {
    const target = await this.targetOf(walletSetting);

    if (options?.withCleanup) {
      await this.cancelReloadCheck(target);
    }

    const createdJobId = await this.jobQueueService.enqueue(
      new WalletBalanceReloadCheck({
        ...target,
        ...(options?.triggeredByDeployment && { triggeredByDeployment: true })
      }),
      {
        singletonKey: singletonKeyOf(WalletBalanceReloadCheck.name, target),
        ...(options?.startAfter && { startAfter: options.startAfter })
      }
    );

    if (!createdJobId) {
      this.logger.error({
        event: "JOB_CREATION_FAILED",
        ...target
      });
      throw new Error("Failed to schedule wallet balance reload check");
    }

    return createdJobId;
  }

  async cancelReloadCheck(target: WalletBillingTarget): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({ name: WalletBalanceReloadCheck.name, singletonKey: singletonKeyOf(WalletBalanceReloadCheck.name, target) });
  }

  /** Best-effort: a failed schedule is logged rather than thrown, because the hourly funding sweep re-evaluates every eligible account anyway. */
  async scheduleCreditsLowCheck(target: WalletBillingTarget, options?: { withCleanup?: boolean }): Promise<string | null> {
    try {
      if (options?.withCleanup) {
        await this.cancelCreditsLowCheck(target);
      }

      const createdJobId = await this.jobQueueService.enqueue(new WalletCreditsLowCheck(target), {
        singletonKey: singletonKeyOf(WalletCreditsLowCheck.name, target)
      });

      if (!createdJobId) {
        this.logger.info({
          event: "CREDITS_LOW_CHECK_ALREADY_QUEUED",
          ...target
        });
      }

      return createdJobId;
    } catch (error) {
      this.logger.error({
        event: "CREDITS_LOW_CHECK_SCHEDULE_FAILED",
        ...target,
        error
      });
      return null;
    }
  }

  /** Best-effort like the credits-low check: every funding pass that leaves the deployment unfunded asks again. */
  async scheduleCreditsExhaustedCheck(data: WalletCreditsExhaustedCheck["data"]): Promise<void> {
    try {
      await this.jobQueueService.enqueue(new WalletCreditsExhaustedCheck(data), {
        singletonKey: singletonKeyOf(WalletCreditsExhaustedCheck.name, data)
      });
    } catch (error) {
      this.logger.error({
        event: "CREDITS_EXHAUSTED_CHECK_SCHEDULE_FAILED",
        ...pickWalletBillingTarget(data),
        error
      });
    }
  }

  async cancelCreditsLowCheck(target: WalletBillingTarget): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({ name: WalletCreditsLowCheck.name, singletonKey: singletonKeyOf(WalletCreditsLowCheck.name, target) });
  }
}

export type WalletReloadImmediateInput = WalletBillingTarget;
