import { inject, singleton } from "tsyringe";

import { isWalletInitialized, UserWalletRepository, type WalletInitialized } from "@src/billing/repositories";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { extractEmailDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import {
  BLOCKED_DOMAIN_LOCK_REASON,
  type EnforcementOutcome,
  TrialAbuseEnforcementService
} from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
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
    private readonly userRepository: UserRepository,
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

    if (!(await this.#isWalletStillOnDomain(wallet.userId, domain))) {
      this.#skip("DOMAIN_CHANGED", { ...context, userId: wallet.userId });
      return;
    }

    const outcome = await this.#wipe(wallet, { ...context, userId: wallet.userId });

    if (!outcome) {
      this.#skip("PAID_DURING_ENFORCEMENT", { ...context, userId: wallet.userId });
      return;
    }

    this.instrumentation.recordEnforcement("enforced");
    this.logger.warn({ event: "BLOCKED_DOMAIN_WALLET_LOCKED", ...context, userId: wallet.userId, owner: wallet.address, ...outcome });
  }

  /** Counted and logged the way the detection path counts its own failures, so a sweep failing on the chain is as visible as a wipe the probe triggered. */
  async #wipe(wallet: WalletInitialized, context: Record<string, unknown>): Promise<EnforcementOutcome | null> {
    try {
      return await this.enforcementService.wipeTrialWallet(wallet, BLOCKED_DOMAIN_LOCK_REASON);
    } catch (error) {
      this.instrumentation.recordEnforcement("failed");
      this.logger.error({ event: "BLOCKED_DOMAIN_WALLET_LOCK_FAILED", ...context, owner: wallet.address, error });
      throw error;
    }
  }

  /** Reads the row rather than the cached verdict, so an operator un-blocking the domain mid-sweep stops the wipes still queued behind it. */
  async #isDomainStillBlocked(domain: string): Promise<boolean> {
    return (await this.blockedEmailDomainRepository.findByDomain(domain))?.status === "blocked";
  }

  /** The sweep picked this wallet off its owner's email, which every login rewrites, so the domain is re-read rather than trusted from the payload. */
  async #isWalletStillOnDomain(userId: string, domain: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);

    return extractEmailDomain(user?.email) === domain;
  }

  #skip(reason: string, context: Record<string, unknown>): void {
    this.logger.info({ event: "BLOCKED_DOMAIN_WALLET_LOCK_SKIPPED", reason, ...context });
    this.instrumentation.recordEnforcement("skipped");
  }
}
