import { subDays, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { TxService } from "@src/core/services/tx/tx.service";
import type { UserOutput } from "@src/user/repositories";
import { type AccountHashes, hashAccount } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import {
  type DeletedTrialAccountOutput,
  DeletedTrialAccountRepository
} from "@src/workload-abuse/repositories/deleted-trial-account/deleted-trial-account.repository";
import { ReviewRefusedTrial } from "@src/workload-abuse/services/review-refused-trial/review-refused-trial.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

export const DELETED_TRIAL_ACCOUNT_ERROR_CODE = "deleted_trial_account";

type Account = Pick<UserOutput, "id" | "userId" | "email">;

interface TrialRefusal {
  latestDeletion: DeletedTrialAccountOutput;
  deletionsOnRecord: number;
}

@singleton()
export class DeletedTrialAccountService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deletedTrialAccountRepository: DeletedTrialAccountRepository,
    private readonly workloadAbuseConfigService: WorkloadAbuseConfigService,
    private readonly jobQueueService: JobQueueService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeletedTrialAccountService.name });
  }

  async remember(account: Account, wallet: Pick<UserWalletOutput, "address" | "activatedAt" | "isTrialing"> | undefined): Promise<void> {
    const memoryDays = this.workloadAbuseConfigService.get("WORKLOAD_ABUSE_DELETED_TRIAL_MEMORY_DAYS");
    if (!memoryDays || !wallet?.activatedAt || !wallet.isTrialing) return;

    const hashes = this.#hashesOf(account);
    if (!hashes.identityHash && !hashes.emailHash) return;

    await this.deletedTrialAccountRepository.deleteOlderThan(subDays(new Date(), memoryDays));
    await this.deletedTrialAccountRepository.create({ ...hashes, walletAddress: wallet.address });
    this.logger.info({ event: "DELETED_TRIAL_ACCOUNT_REMEMBERED", userId: account.id });
  }

  /** The review is queued in the transaction that marks the refusal, so it is raised once per refused account and never lost. */
  async refusesTrialOf(account: Account): Promise<boolean> {
    const refusal = await this.#findRefusalOf(account);
    if (!refusal) return false;

    const { latestDeletion, deletionsOnRecord } = refusal;

    await this.txService.transaction(async () => {
      const isFirstRefusal = await this.deletedTrialAccountRepository.markRefusedOnce(latestDeletion.id, account.id);
      if (!isFirstRefusal) return;

      await this.jobQueueService.enqueue(
        new ReviewRefusedTrial({
          userId: account.id,
          deletedAccount: { walletAddress: latestDeletion.walletAddress, deletedAt: latestDeletion.createdAt.toISOString(), deletionsOnRecord }
        })
      );
    });

    this.logger.info({ event: "TRIAL_REFUSED_AFTER_ACCOUNT_DELETION", userId: account.id, deletionsOnRecord });
    return true;
  }

  async #findRefusalOf(account: Account): Promise<TrialRefusal | undefined> {
    const memoryDays = this.workloadAbuseConfigService.get("WORKLOAD_ABUSE_DELETED_TRIAL_MEMORY_DAYS");
    if (!memoryDays) return undefined;

    const now = new Date();
    const deletions = await this.deletedTrialAccountRepository.findByAnyHashSince(this.#hashesOf(account), subDays(now, memoryDays));
    const [latestDeletion] = deletions;
    if (!latestDeletion) return undefined;

    const cooldownHours = this.workloadAbuseConfigService.get("WORKLOAD_ABUSE_DELETED_TRIAL_COOLDOWN_HOURS");
    const maxReturns = this.workloadAbuseConfigService.get("WORKLOAD_ABUSE_DELETED_TRIAL_MAX_RETURNS");
    const isInCooldown = cooldownHours !== undefined && latestDeletion.createdAt > subHours(now, cooldownHours);
    const isOverMaxReturns = maxReturns !== undefined && deletions.length > maxReturns;

    return isInCooldown || isOverMaxReturns ? { latestDeletion, deletionsOnRecord: deletions.length } : undefined;
  }

  #hashesOf(account: Account): AccountHashes {
    return hashAccount(this.workloadAbuseConfigService.get("WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET"), account);
  }
}
