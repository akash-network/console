import { inject, singleton } from "tsyringe";

import { type PersonalWallet, UserWalletRepository } from "@src/billing/repositories";
import { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import { type CreateLogger, JOB_NAME, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { type UserOutput, UserRepository } from "@src/user/repositories";
import { extractEmailDomain, getRegistrableDomain } from "@src/workload-abuse/lib/email-domain/email-domain";
import { isPublicEmailProvider } from "@src/workload-abuse/lib/email-domain/public-email-providers";
import {
  type BlockedEmailDomainOutput,
  BlockedEmailDomainRepository
} from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import { EmailDomainMailProfileService } from "@src/workload-abuse/services/email-domain-mail-profile/email-domain-mail-profile.service";
import type { EmailDomainSignal } from "@src/workload-abuse/services/email-domain-reputation/email-domain-reputation.service";
import {
  LockBlockedDomainWallet,
  lockBlockedDomainWalletKeyFor
} from "@src/workload-abuse/services/lock-blocked-domain-wallet/lock-blocked-domain-wallet.handler";
import { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";

export const DOMAIN_BLOCK_REASON = "workload_abuse";

export const HELD_SIGNUP_BLOCK_REASON = "held_signup";

export type HeldSignupBlockEvidence = Extract<EmailDomainSignal, { blockedDomain: string }>;

export type HeldSignup = {
  userId: UserOutput["id"];
  emailDomain: string;
  evidence: HeldSignupBlockEvidence;
};

type BlockRequest = {
  userId: UserOutput["id"];
  context: Record<string, unknown>;
  excludeWalletId?: number;
  assessedEmailDomain?: string;
  reason: string;
  isEnforcing: boolean;
  hasSecondAccount: (domain: string) => Promise<boolean>;
};

type SkipReason =
  | "no_domain"
  | "email_changed"
  | "public_suffix"
  | "public_provider"
  | "allowlisted"
  | "already_blocked"
  | "domain_has_paid_user"
  | "domain_predates_attack"
  | "awaiting_second_account";

/**
 * Turns a second mailbox caught mining on an email domain, or a held sign-up tied to an already blocked domain, into a block on its whole registrable domain, so the next
 * account on it never gets a trial. Blunt by design, so three guardrails stand in front of it:
 * a public provider, a domain anybody has ever paid from, and a domain older than the attack are all
 * left alone and merely recorded. The first caught mailbox only locks its own wallet.
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
    private readonly emailDomainMailProfileService: EmailDomainMailProfileService,
    private readonly detectionRepository: WorkloadAbuseDetectionRepository,
    private readonly jobQueueService: JobQueueService,
    private readonly config: WorkloadAbuseConfigService,
    private readonly instrumentation: WorkloadAbuseInstrumentationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: EmailDomainBlockService.name });
  }

  /** Throws: it runs on the queue, where a transient failure is worth a retry rather than a lost block. */
  async blockDomainOf(wallet: PersonalWallet): Promise<void> {
    await this.#block({
      userId: wallet.userId,
      context: { walletId: wallet.id },
      excludeWalletId: wallet.id,
      reason: DOMAIN_BLOCK_REASON,
      isEnforcing: this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MODE") === "enforce",
      hasSecondAccount: async domain => await this.detectionRepository.hasEnforcedSignatureMatchByAnotherMailbox(domain, wallet.userId)
    });
  }

  /** The hold already tied the domain to a blocked one, which stands in for the second mining mailbox the workload path waits for. */
  async blockDomainOfHeldSignup({ userId, emailDomain, evidence }: HeldSignup): Promise<void> {
    const mode = this.config.get("WORKLOAD_ABUSE_HELD_SIGNUP_DOMAIN_BLOCK_MODE");
    if (mode === "off") return;

    await this.#block({
      userId,
      context: { trigger: "held_signup", signal: evidence.signal, blockedDomain: evidence.blockedDomain },
      assessedEmailDomain: emailDomain,
      reason: HELD_SIGNUP_BLOCK_REASON,
      isEnforcing: mode === "enforce",
      hasSecondAccount: async () => true
    });
  }

  async #block(request: BlockRequest): Promise<void> {
    const { userId } = request;
    const user = await this.userRepository.findById(userId);
    const emailDomain = extractEmailDomain(user?.email);

    if (!emailDomain) return this.#skip("no_domain", { ...request.context, userId });

    if (request.assessedEmailDomain && emailDomain !== request.assessedEmailDomain) {
      return this.#skip("email_changed", { ...request.context, userId, emailDomain, assessedEmailDomain: request.assessedEmailDomain });
    }

    const domain = getRegistrableDomain(emailDomain);

    if (!domain) return this.#skip("public_suffix", { ...request.context, userId, emailDomain });

    const context = { ...request.context, userId, domain, emailDomain };

    if (isPublicEmailProvider(domain)) return this.#skip("public_provider", context);

    const existing = await this.#findGoverningRule(emailDomain, domain);

    if (existing?.status === "allowed") return this.#skip("allowlisted", context);

    if (existing?.status === "blocked") {
      this.#skip("already_blocked", context);
      if (request.isEnforcing) await this.#sweepSiblings(domain, request.excludeWalletId);
      return;
    }

    if (await this.stripeTransactionRepository.hasPaidUserWithEmailDomain(domain)) return this.#skip("domain_has_paid_user", context);

    const minAccountAgeDays = this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS");
    if (await this.userRepository.hasEstablishedUserWithEmailDomain(domain, minAccountAgeDays, userId)) return this.#skip("domain_predates_attack", context);

    if (!(await request.hasSecondAccount(domain))) return this.#skip("awaiting_second_account", context);

    if (!request.isEnforcing) {
      this.instrumentation.recordDomainBlock("dry_run");
      this.logger.info({ event: "EMAIL_DOMAIN_AUTO_BLOCK_DRY_RUN", ...context });
      return;
    }

    const blocked = await this.blockedEmailDomainRepository.blockIfAbsent({ domain, reason: request.reason, triggeredByUserId: userId });

    if (blocked) {
      this.blockedEmailDomainService.rememberBlocked(domain);
      this.instrumentation.recordDomainBlock("blocked");
      this.logger.warn({ event: "EMAIL_DOMAIN_AUTO_BLOCKED", ...context });
      await this.emailDomainMailProfileService.recordProfile(domain);
    } else if (!(await this.#adoptRacedBlock(domain, context))) {
      return;
    }

    await this.#sweepSiblings(domain, request.excludeWalletId);
  }

  /** The address's own nearest allow stops the block, while a block only counts once it covers the whole registrable domain. */
  async #findGoverningRule(emailDomain: string, domain: string): Promise<BlockedEmailDomainOutput | undefined> {
    const addressRule = await this.blockedEmailDomainRepository.findNearestRule(emailDomain);
    const isBlockBelowDomain = addressRule?.status === "blocked" && addressRule.domain.endsWith(`.${domain}`);

    return isBlockBelowDomain ? await this.blockedEmailDomainRepository.findNearestRule(domain) : addressRule;
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
  async #sweepSiblings(domain: string, excludeWalletId: number | undefined): Promise<void> {
    const limit = this.config.get("WORKLOAD_ABUSE_DOMAIN_BLOCK_MAX_SIBLINGS");
    const overfetched = await this.userWalletRepository.findLockableTrialWalletsByEmailDomain(domain, { excludeWalletId, limit: limit + 1 });

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

  #skip(reason: SkipReason, context: Record<string, unknown>): void {
    this.instrumentation.recordDomainBlock("skipped", reason);
    this.logger.info({ event: "EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED", reason, ...context });
  }
}
