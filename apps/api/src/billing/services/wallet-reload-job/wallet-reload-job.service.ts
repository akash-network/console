import { inject, singleton } from "tsyringe";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletCreditsLowCheck } from "@src/billing/events/wallet-credits-low-check";
import { isAutoReloadActive } from "@src/billing/lib/auto-reload/auto-reload";
import { UserWalletRepository, WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { EnqueueOptions, JobQueueService } from "@src/core";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";

@singleton()
export class WalletReloadJobService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly jobQueueService: JobQueueService,
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
      await this.scheduleForWalletSetting(walletSetting, { withCleanup: true, triggeredByDeployment: options?.triggeredByDeployment });
      return true;
    }

    return false;
  }

  async scheduleCreditsLowCheckIfAutoReloadOff(input: { walletId: number }): Promise<void> {
    const walletSetting = await this.walletSettingRepository.findOneBy({ walletId: input.walletId });

    if (isAutoReloadActive(walletSetting)) {
      return;
    }

    const userId = await this.#resolveUserId(input, walletSetting);
    if (!userId) {
      return;
    }

    await this.scheduleCreditsLowCheck(userId, { withCleanup: true });
  }

  async scheduleForWalletSetting(
    walletSetting: Pick<WalletSettingOutput, "id" | "userId">,
    options?: Pick<EnqueueOptions, "startAfter"> & { withCleanup?: boolean; triggeredByDeployment?: boolean }
  ): Promise<string> {
    if (options?.withCleanup) {
      await this.cancelCreatedByUserId(walletSetting.userId);
    }

    const createdJobId = await this.jobQueueService.enqueue(
      new WalletBalanceReloadCheck({
        userId: walletSetting.userId,
        ...(options?.triggeredByDeployment && { triggeredByDeployment: true })
      }),
      {
        singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`,
        ...(options?.startAfter && { startAfter: options.startAfter })
      }
    );

    if (!createdJobId) {
      this.logger.error({
        event: "JOB_CREATION_FAILED",
        userId: walletSetting.userId
      });
      throw new Error("Failed to schedule wallet balance reload check");
    }

    return createdJobId;
  }

  async cancelCreatedByUserId(userId: string): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({ name: WalletBalanceReloadCheck.name, singletonKey: `${WalletBalanceReloadCheck.name}.${userId}` });
  }

  /** Best-effort: a failed schedule is logged rather than thrown, because the hourly funding sweep re-evaluates every eligible account anyway. */
  async scheduleCreditsLowCheck(userId: string, options?: { withCleanup?: boolean }): Promise<string | null> {
    try {
      if (options?.withCleanup) {
        await this.cancelCreditsLowCheckByUserId(userId);
      }

      const createdJobId = await this.jobQueueService.enqueue(new WalletCreditsLowCheck({ userId }), {
        singletonKey: `${WalletCreditsLowCheck.name}.${userId}`
      });

      if (!createdJobId) {
        this.logger.info({
          event: "CREDITS_LOW_CHECK_ALREADY_QUEUED",
          userId
        });
      }

      return createdJobId;
    } catch (error) {
      this.logger.error({
        event: "CREDITS_LOW_CHECK_SCHEDULE_FAILED",
        userId,
        error
      });
      return null;
    }
  }

  async cancelCreditsLowCheckByUserId(userId: string): Promise<void> {
    await this.jobQueueService.cancelCreatedBy({ name: WalletCreditsLowCheck.name, singletonKey: `${WalletCreditsLowCheck.name}.${userId}` });
  }

  async #resolveUserId(input: WalletReloadImmediateInput, walletSetting?: WalletSettingOutput): Promise<string | undefined> {
    if (walletSetting?.userId) {
      return walletSetting.userId;
    }

    if ("userId" in input) {
      return input.userId;
    }

    const wallet = await this.userWalletRepository.findOneBy({ id: input.walletId });
    return wallet?.userId;
  }
}

export type WalletReloadImmediateInput = { userId: string } | { walletId: number };
