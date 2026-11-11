import { inject, singleton } from "tsyringe";

import type { UserWalletOutput } from "@src/billing/repositories";
import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import type { UserOutput } from "@src/user/repositories";
import { ABUSE_LOCK_REASON } from "@src/workload-abuse/lib/abuse-lock-reason/abuse-lock-reason";
import { type AccountHashes, hashAccount } from "@src/workload-abuse/lib/account-hashes/account-hashes";
import { DeletedAccountAbuseLockRepository } from "@src/workload-abuse/repositories/deleted-account-abuse-lock/deleted-account-abuse-lock.repository";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";

type Account = Pick<UserOutput, "id" | "userId" | "email">;

@singleton()
export class DeletedAccountAbuseLockService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly deletedAccountAbuseLockRepository: DeletedAccountAbuseLockRepository,
    private readonly workloadAbuseConfigService: WorkloadAbuseConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: DeletedAccountAbuseLockService.name });
  }

  /** A lock for the account's email domain is left to the domain block, which outlives the account on its own and only an operator lifts. */
  async rememberLockOf(account: Account, wallet: Pick<UserWalletOutput, "abuseLockedAt" | "abuseLockedReason"> | undefined): Promise<void> {
    if (!wallet?.abuseLockedAt || wallet.abuseLockedReason !== ABUSE_LOCK_REASON) return;

    const hashes = this.#hashesOf(account);
    if (!hashes.identityHash && !hashes.emailHash) return;

    await this.deletedAccountAbuseLockRepository.create({ ...hashes, reason: wallet.abuseLockedReason });
    this.logger.info({ event: "DELETED_ACCOUNT_ABUSE_LOCK_REMEMBERED", userId: account.id, reason: wallet.abuseLockedReason });
  }

  async findLockReasonOf(account: Account): Promise<string | undefined> {
    const lock = await this.deletedAccountAbuseLockRepository.findByAnyHash(this.#hashesOf(account));
    if (!lock) return undefined;

    this.logger.info({ event: "DELETED_ACCOUNT_ABUSE_LOCK_MATCHED", userId: account.id, reason: lock.reason });
    return lock.reason;
  }

  #hashesOf(account: Account): AccountHashes {
    return hashAccount(this.workloadAbuseConfigService.get("WORKLOAD_ABUSE_ACCOUNT_HASH_SECRET"), account);
  }
}
