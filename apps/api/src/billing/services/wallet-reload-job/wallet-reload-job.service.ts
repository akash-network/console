import { singleton } from "tsyringe";
import { v4 as uuidv4 } from "uuid";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { EnqueueOptions, JobQueueService, TxService } from "@src/core";
import { LoggerService } from "@src/core/providers/logging.provider";

@singleton()
export class WalletReloadJobService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    private readonly logger: LoggerService
  ) {
    this.logger.setContext(WalletReloadJobService.name);
  }

  async scheduleImmediate(userId: string): Promise<void> {
    const walletSetting = await this.walletSettingRepository.findByUserId(userId);

    if (!walletSetting || !walletSetting.userId || !walletSetting.autoReloadEnabled) {
      return;
    }

    await this.scheduleForWalletSetting(walletSetting, { prevAction: "cancel" });
  }

  async scheduleForWalletSetting(
    walletSetting: Pick<WalletSettingOutput, "id" | "userId" | "autoReloadJobId">,
    options?: Pick<EnqueueOptions, "startAfter"> & { prevAction?: "cancel" | "complete" }
  ): Promise<string> {
    return await this.txService.transaction(async () => {
      // Try to cancel/complete the previous job if it exists
      // This may fail if the job is already in a terminal state, which is fine
      if (walletSetting.autoReloadJobId) {
        this.logger.info({
          event: "PREVIOUS_JOB_CLEANUP",
          action: options?.prevAction,
          previousJobId: walletSetting.autoReloadJobId,
          userId: walletSetting.userId
        });

        if (options?.prevAction === "cancel") {
          await this.jobQueueService.cancel(WalletBalanceReloadCheck.name, walletSetting.autoReloadJobId);
        } else {
          await this.jobQueueService.complete(WalletBalanceReloadCheck.name, walletSetting.autoReloadJobId);
        }
      }

      const jobId = uuidv4();
      await this.walletSettingRepository.updateById(walletSetting.id, { autoReloadJobId: jobId });

      const createdJobId = await this.jobQueueService.enqueue(new WalletBalanceReloadCheck({ userId: walletSetting.userId }), {
        singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`,
        id: jobId,
        ...(options?.startAfter && { startAfter: options.startAfter })
      });

      if (!createdJobId) {
        this.logger.error({
          event: "JOB_CREATION_FAILED",
          message: "Failed to schedule wallet balance reload check - a job already exists for this user",
          userId: walletSetting.userId,
          attemptedJobId: jobId,
          previousJobId: walletSetting.autoReloadJobId
        });
        throw new Error("Failed to schedule wallet balance reload check: job already exists");
      }

      this.logger.info({
        event: "JOB_SCHEDULED",
        jobId: createdJobId,
        userId: walletSetting.userId,
        startAfter: options?.startAfter
      });

      return jobId;
    });
  }

  async cancel(userId: string, jobId: string): Promise<void> {
    await this.jobQueueService.cancel(WalletBalanceReloadCheck.name, jobId);
  }
}
