import { singleton } from "tsyringe";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { EnqueueOptions, JobQueueService } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";

@singleton()
export class WalletReloadJobService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(WalletReloadJobService.name);
  }

  async scheduleImmediate(input: WalletReloadImmediateInput): Promise<boolean> {
    const walletSetting =
      "userId" in input
        ? await this.walletSettingRepository.findByUserId(input.userId)
        : await this.walletSettingRepository.findOneBy({ walletId: input.walletId });

    if (walletSetting?.autoReloadEnabled) {
      await this.scheduleForWalletSetting(walletSetting);
      return true;
    }

    return false;
  }

  async scheduleForWalletSetting(
    walletSetting: Pick<WalletSettingOutput, "id" | "userId">,
    options?: Pick<EnqueueOptions, "startAfter"> & { withCleanup?: boolean }
  ): Promise<string> {
    if (options?.withCleanup) {
      await this.cancelCreatedByUserId(walletSetting.userId);
    }

    const createdJobId = await this.jobQueueService.enqueue(
      new WalletBalanceReloadCheck({
        userId: walletSetting.userId
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
}

export type WalletReloadImmediateInput = { userId: string } | { walletId: number };
