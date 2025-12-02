import { singleton } from "tsyringe";
import { v4 as uuidv4 } from "uuid";

import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { EnqueueOptions, JobQueueService, TxService } from "@src/core";

@singleton()
export class WalletReloadJobService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService
  ) {}

  async scheduleImmediate(userId: string): Promise<void> {
    const walletSetting = await this.walletSettingRepository.findByUserId(userId);

    if (!walletSetting || !walletSetting.userId) {
      return;
    }

    await this.scheduleForWalletSetting(walletSetting);
  }

  async scheduleForWalletSetting(
    walletSetting: Pick<WalletSettingOutput, "id" | "userId" | "autoReloadJobId">,
    options?: Pick<EnqueueOptions, "startAfter"> & { prevAction?: "cancel" | "complete" }
  ): Promise<string> {
    return await this.txService.transaction(async () => {
      if (walletSetting.autoReloadJobId) {
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
        throw new Error("Failed to schedule wallet balance reload check");
      }

      return jobId;
    });
  }

  async cancel(userId: string, jobId: string): Promise<void> {
    await this.jobQueueService.cancel(WalletBalanceReloadCheck.name, jobId);
  }
}
