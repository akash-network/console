import { inject, singleton } from "tsyringe";

import { UserWalletRepository, type WalletInitialized } from "@src/billing/repositories";
import { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { UserRepository } from "@src/user/repositories";
import { extractEmailDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { isPublicEmailProvider } from "@src/workload-abuse/lib/email-domain/public-email-providers";
import { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import {
  LockBlockedDomainWallet,
  lockBlockedDomainWalletKeyFor
} from "@src/workload-abuse/services/lock-blocked-domain-wallet/lock-blocked-domain-wallet.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export const DOMAIN_BLOCK_REASON = "workload_abuse";

type SkipReason = "no_domain" | "public_provider" | "allowlisted" | "already_blocked" | "domain_has_paid_user" | "domain_predates_attack";

/**
 * Turns one wallet caught mining into a block on the whole email domain it signed up from, so the next
 * account on that domain never gets a trial. Blunt by design, so three guardrails stand in front of it:
 * a public provider, a domain anybody has ever paid from, and a domain older than the attack are all
 * left alone and merely recorded.
 */
@singleton()
export class EmailDomainBlockService {
  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly userRepository: UserRepository,
    private readonly userWalletRepository: UserWalletRepository,
    private readonly stripeTransactionRepository: StripeTransactionRepository,
    private readonly blockedEmailDomainRepository: BlockedEmailDomainRepository,
    private readonly blockedEmailDomainService: BlockedEmailDomainService,
    private readonly jobQueueService: JobQueueService,
    private readonly config: WorkloadAbuseConfigService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: EmailDomainBlockService.name });
  }

  /** Throws: it runs on the queue, where a transient failure is worth a retry rather than a lost block. */
  async blockDomainOf(wallet: WalletInitialized): Promise<void> {
    const user = await this.userRepository.findById(wallet.userId);
    const domain = extractEmailDomain(user?.email);

    if (!domain) return this.#skip("no_domain", { walletId: wallet.id, userId: wallet.userId });

    const context = { walletId: wallet.id, userId: wallet.userId, domain };

    if (isPublicEmailProvider(domain)) return this.#skip("public_provider", context);

    const existing = await this.blockedEmailDomainRepository.findByDomain(domain);

    if (existing?.status === "allowed") return this.#skip("allowlisted", context);

    if (existing?.status === "blocked") {
      this.#skip("already_blocked", context);
      await this.#sweepSiblings(domain, wallet);
      return;
    }

    if (await this.stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)) return this.#skip("domain_has_paid_user", context);

    const minAccountAgeDays = this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS");
    if (await this.userRepository.hasEstablishedUserWithEmailDomain(domain, minAccountAgeDays, wallet.userId))
      return this.#skip("domain_predates_attack", context);

    if (!this.#isEnforcing) {
      this.instrumentation.recordDomainBlock("dry_run");
      this.logger.info({ event: "EMAIL_DOMAIN_AUTO_BLOCK_DRY_RUN", ...context });
      return;
    }

    const blocked = await this.blockedEmailDomainRepository.blockIfAbsent({
      domain,
      reason: DOMAIN_BLOCK_REASON,
      triggeredByUserId: wallet.userId
    });

    if (blocked) {
      this.blockedEmailDomainService.rememberBlocked(domain);
      this.instrumentation.recordDomainBlock("blocked");
      this.logger.warn({ event: "EMAIL_DOMAIN_AUTO_BLOCKED", ...context });
    } else if (!(await this.#adoptRacedBlock(domain, context))) {
      return;
    }

    await this.#sweepSiblings(domain, wallet);
  }

  /** The insert lost to a row written since the read above, so the row that won says whether this is another pod's block to adopt or an operator's allow that outranks it. */
  async #adoptRacedBlock(domain: string, context: Record<string, unknown>): Promise<boolean> {
    const winner = await this.blockedEmailDomainRepository.findByDomain(domain);

    if (winner?.status !== "blocked") {
      this.#skip("allowlisted", context);
      return false;
    }

    this.blockedEmailDomainService.rememberBlocked(domain);
    this.instrumentation.recordDomainBlock("raced");
    this.logger.info({ event: "EMAIL_DOMAIN_AUTO_BLOCK_RACED", ...context });

    return true;
  }

  /** Nothing else requeues a sibling this sweep drops, so every sibling is attempted and the first enqueue failure is rethrown onto the job's retry budget. */
  async #sweepSiblings(domain: string, wallet: WalletInitialized): Promise<void> {
    if (!this.#isEnforcing) return;

    const limit = this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MAX_SIBLINGS");
    const overfetched = await this.userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId: wallet.id, limit: limit + 1 });

    if (overfetched.length === 0) return;

    const siblings = overfetched.slice(0, limit);
    const moreThanTheLimitExist = overfetched.length > limit;

    if (moreThanTheLimitExist) {
      this.instrumentation.recordDomainBlock("sibling_limit_reached");
      this.logger.warn({ event: "BLOCKED_DOMAIN_SIBLING_LIMIT_REACHED", domain, limit });
    }

    const pendingKeys = await this.jobQueueService.findPendingSingletonKeys(LockBlockedDomainWallet[JOB_NAME]);
    let enqueued = 0;
    let alreadyQueued = 0;
    let failed = 0;
    let firstError: unknown;

    for (const { walletId } of siblings) {
      const singletonKey = lockBlockedDomainWalletKeyFor(walletId);

      if (pendingKeys.has(singletonKey)) {
        alreadyQueued++;
        continue;
      }

      try {
        const jobId = await this.jobQueueService.enqueue(new LockBlockedDomainWallet({ walletId, domain }), { singletonKey });
        if (jobId) enqueued++;
        else alreadyQueued++;
      } catch (error) {
        this.logger.error({ event: "BLOCKED_DOMAIN_SIBLING_ENQUEUE_FAILED", domain, walletId, error });
        failed++;
        firstError ??= error;
      }
    }

    this.logger.info({ event: "BLOCKED_DOMAIN_SIBLINGS_SWEPT", domain, found: siblings.length, enqueued, alreadyQueued, failed });

    if (firstError) throw firstError;
  }

  get #isEnforcing(): boolean {
    return this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MODE") === "enforce";
  }

  #skip(reason: SkipReason, context: Record<string, unknown>): void {
    this.instrumentation.recordDomainBlock("skipped", reason);
    this.logger.info({ event: "EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED", reason, ...context });
  }
}
