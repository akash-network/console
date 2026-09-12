import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository } from "@src/billing/repositories";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { BLOCKED_DOMAIN_LOCK_REASON, TrialAbuseEnforcementService } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export class LockBlockedDomainWallet implements Job {
  static readonly [JOB_NAME] = "LockBlockedDomainWallet";
  readonly name = LockBlockedDomainWallet[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: {
      walletId: number;
      domain: string;
    }
  ) {}
}

/** Keyed by wallet, not by domain: two sweeps of the same domain must not suppress each other's wallets. */
export function lockBlockedDomainWalletKeyFor(walletId: number): string {
  return `lockBlockedDomainWallet.${walletId}`;
}

/** Wipes one trial wallet caught by its email domain, re-reading every precondition so a wallet that paid or was already locked is left alone. */
@singleton()
export class LockBlockedDomainWalletHandler implements JobHandler<LockBlockedDomainWallet> {
  public readonly accepts = LockBlockedDomainWallet;

  public readonly concurrency = 1;

  public readonly policy = "stately";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userWalletRepository: UserWalletRepository,
    private readonly blockedEmailDomainRepository: BlockedEmailDomainRepository,
    private readonly enforcementService: TrialAbuseEnforcementService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: LockBlockedDomainWalletHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle(payload: JobPayload<LockBlockedDomainWallet>): Promise<void> {
    const { walletId, domain } = payload;
    const context = { job: LockBlockedDomainWallet[JOB_NAME], walletId, domain };
    const wallet = await this.userWalletRepository.findById(walletId);

    if (!wallet || !isWalletInitialized(wallet)) {
      this.#skip("WALLET_NOT_FOUND", context);
      return;
    }

    if (wallet.abuseLockedAt) {
      this.#skip("ALREADY_LOCKED", { ...context, userId: wallet.userId });
      return;
    }

    if (!wallet.isTrialing) {
      this.#skip("NOT_TRIALING", { ...context, userId: wallet.userId });
      return;
    }

    if (!(await this.#isDomainStillBlocked(domain))) {
      this.#skip("DOMAIN_NOT_BLOCKED", { ...context, userId: wallet.userId });
      return;
    }

    const outcome = await this.enforcementService.wipeTrialWallet(wallet, BLOCKED_DOMAIN_LOCK_REASON);

    if (!outcome) {
      this.#skip("PAID_DURING_ENFORCEMENT", { ...context, userId: wallet.userId });
      return;
    }

    this.instrumentation.recordEnforcement("enforced");
    this.logger.warn({ event: "BLOCKED_DOMAIN_WALLET_LOCKED", ...context, userId: wallet.userId, owner: wallet.address, ...outcome });
  }

  /** Reads the row rather than the cached verdict, so an operator un-blocking the domain mid-sweep stops the wipes still queued behind it. */
  async #isDomainStillBlocked(domain: string): Promise<boolean> {
    return (await this.blockedEmailDomainRepository.findByDomain(domain))?.status === "blocked";
  }

  #skip(reason: string, context: Record<string, unknown>): void {
    this.logger.info({ event: "BLOCKED_DOMAIN_WALLET_LOCK_SKIPPED", reason, ...context });
    this.instrumentation.recordEnforcement("skipped");
  }
}
