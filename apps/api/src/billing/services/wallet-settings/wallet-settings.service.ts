import assert from "http-assert";
import { PostgresError } from "postgres";
import { singleton } from "tsyringe";
import { v4 as uuidv4 } from "uuid";

import { AuthService } from "@src/auth/services/auth.service";
import { WalletBalanceReloadCheck } from "@src/billing/events/wallet-balance-reload-check";
import { UserWalletRepository, type WalletSettingOutput, WalletSettingRepository } from "@src/billing/repositories";
import { JobQueueService, WithTransaction } from "@src/core";
import { UserOutput } from "@src/user/repositories";

export interface WalletSetting {
  autoReloadEnabled?: boolean;
  autoReloadThreshold?: number;
  autoReloadAmount?: number;
}

@singleton()
export class WalletSettingService {
  constructor(
    private readonly walletSettingRepository: WalletSettingRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly authService: AuthService,
    private readonly jobQueueService: JobQueueService
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
  async upsertWalletSetting(userId: UserOutput["id"], input: WalletSetting): Promise<Omit<WalletSettingOutput, "autoReloadJobId">> {
    let mutationResult = await this.update(userId, input);

    if (!mutationResult.next) {
      mutationResult = await this.create(userId, input);
    }

    await this.arrangeSchedule(mutationResult.prev, mutationResult.next);

    const { autoReloadJobId, ...setting } = mutationResult.next!;

    return setting;
  }

  private async update(userId: UserOutput["id"], settings: WalletSetting): Promise<{ prev?: WalletSettingOutput; next?: WalletSettingOutput }> {
    const { ability } = this.authService;

    const prev = await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);

    if (prev) {
      this.validate(settings, prev);
      const next = await this.walletSettingRepository.accessibleBy(ability, "update").updateById(prev.id, settings, { returning: true });

      if (!next) {
        return {};
      }

      return { prev, next };
    }

    return {};
  }

  private async create(userId: UserOutput["id"], settings: WalletSetting): Promise<{ prev?: WalletSettingOutput; next: WalletSettingOutput }> {
    this.validate(settings);

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
      if (this.isDuplicateError(error)) {
        const updatedSettingRetried = await this.update(userId, settings);

        assert(updatedSettingRetried.next, 500, "Failed to create a wallet setting");

        return {
          prev: updatedSettingRetried.prev,
          next: updatedSettingRetried.next
        };
      }
      throw error;
    }
  }

  private isDuplicateError(error: unknown): error is PostgresError & { code: "23505" } {
    return error instanceof PostgresError && error.code === "23505";
  }

  private validate(settings: WalletSetting, existingSetting?: WalletSettingOutput) {
    if (settings.autoReloadEnabled === true) {
      const threshold = settings.autoReloadThreshold ?? existingSetting?.autoReloadThreshold;
      const amount = settings.autoReloadAmount ?? existingSetting?.autoReloadAmount;

      assert(
        typeof threshold === "number" && typeof amount === "number",
        400,
        '"autoReloadThreshold" and "autoReloadAmount" are required when "autoReloadEnabled" is true'
      );
    }
  }

  private async arrangeSchedule(prev?: WalletSettingOutput, next?: WalletSettingOutput) {
    if (!prev?.autoReloadEnabled && next?.autoReloadEnabled) {
      await this.schedule(next);
    }

    if (!next?.autoReloadEnabled && next?.autoReloadJobId) {
      await this.jobQueueService.cancel(WalletBalanceReloadCheck.name, next.autoReloadJobId);
    }
  }

  private async schedule(walletSetting: WalletSettingOutput) {
    if (walletSetting.autoReloadJobId) {
      await this.jobQueueService.cancel(WalletBalanceReloadCheck.name, walletSetting.autoReloadJobId);
    }

    const jobId = uuidv4();
    await this.walletSettingRepository.updateById(walletSetting.id, { autoReloadJobId: jobId });

    const createdJobId = await this.jobQueueService.enqueue(new WalletBalanceReloadCheck({ userId: walletSetting.userId }), {
      singletonKey: `${WalletBalanceReloadCheck.name}.${walletSetting.userId}`,
      id: jobId
    });

    assert(createdJobId, 500, "Failed to schedule wallet balance reload check");

    return jobId;
  }

  async deleteWalletSetting(userId: string): Promise<void> {
    const { ability } = this.authService;
    const walletSetting = await this.walletSettingRepository.accessibleBy(ability, "read").findByUserId(userId);

    assert(walletSetting, 404, "WalletSetting Not Found");

    await Promise.all([
      this.walletSettingRepository.accessibleBy(ability, "delete").deleteBy({ userId }),
      ...(walletSetting.autoReloadJobId ? [this.jobQueueService.cancel(WalletBalanceReloadCheck.name, walletSetting.autoReloadJobId)] : [])
    ]);
  }
}
