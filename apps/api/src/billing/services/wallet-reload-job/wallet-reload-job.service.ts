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
        const action = options?.prevAction ?? "complete";
        this.logger.info({
          event: "PREVIOUS_JOB_CLEANUP",
          action,
          previousJobId: walletSetting.autoReloadJobId,
          userId: walletSetting.userId
        });

        if (action === "cancel") {
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
        // singletonKey returned null - this means a job with this key already exists in an active state
        // This can happen if there's a race condition or the previous job hasn't been fully processed yet
        // Log a warning but don't fail - having a job already scheduled is acceptable
        this.logger.warn({
          event: "JOB_ALREADY_EXISTS",
          message: "A wallet balance reload check job already exists for this user. Skipping creation.",
          userId: walletSetting.userId,
          attemptedJobId: jobId,
          previousJobId: walletSetting.autoReloadJobId
        });
        // Return the attempted job ID - the wallet setting was updated with this ID
        // The existing active job will continue to run and schedule the next check
        return jobId;
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
