import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository, WalletInitialized } from "@src/billing/repositories";
import type { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import type { CreateLogger } from "@src/core";
import type { JobQueueService } from "@src/core";
import type { UserRepository } from "@src/user/repositories";
import type { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import { LockBlockedDomainWallet } from "@src/workload-abuse/services/lock-blocked-domain-wallet/lock-blocked-domain-wallet.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { DOMAIN_BLOCK_REASON, EmailDomainBlockService } from "./email-domain-block.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBlockedEmailDomain } from "@test/seeders/blocked-email-domain.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

describe(EmailDomainBlockService.name, () => {
  describe("onTrialWalletLocked", () => {
    it("blocks the domain of the wallet it was given", async () => {
      const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({ email: "miner@attacker.com" });

      await service.onTrialWalletLocked(wallet);

      expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith({
        domain: "attacker.com",
        reason: DOMAIN_BLOCK_REASON,
        triggeredByUserId: wallet.userId
      });
      expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("blocked");
    });

    it("primes the lookup cache so the sweep does not wait out a stale negative", async () => {
      const { service, wallet, blockedEmailDomainService } = setup({ email: "miner@attacker.com" });

      await service.onTrialWalletLocked(wallet);

      expect(blockedEmailDomainService.rememberBlocked).toHaveBeenCalledWith("attacker.com");
    });

    it("blocks the normalized domain of a mixed-case address", async () => {
      const { service, wallet, blockedEmailDomainRepository } = setup({ email: "Miner@Attacker.COM" });

      await service.onTrialWalletLocked(wallet);

      expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ domain: "attacker.com" }));
    });

    describe("guardrails", () => {
      it.each([
        { reason: "no_domain", input: { email: null } },
        { reason: "public_provider", input: { email: "miner@gmail.com" } },
        { reason: "allowlisted", input: { existing: createBlockedEmailDomain({ domain: "attacker.com", status: "allowed" }) } },
        { reason: "domain_has_paid_user", input: { hasPaidUser: true } },
        { reason: "domain_predates_attack", input: { hasEstablishedUser: true } }
      ])("skips with $reason and writes nothing", async ({ reason, input }) => {
        const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({ email: "miner@attacker.com", ...input });

        await service.onTrialWalletLocked(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", reason);
      });

      it("does not sweep siblings of a domain an operator has allowed", async () => {
        const { service, wallet, jobQueueService } = setup({
          email: "miner@customer.com",
          existing: createBlockedEmailDomain({ domain: "customer.com", status: "allowed" }),
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.onTrialWalletLocked(wallet);

        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      });

      it("sweeps siblings of a domain that is already blocked, because the first sweep can have missed one", async () => {
        const { service, wallet, blockedEmailDomainRepository, jobQueueService, instrumentation } = setup({
          email: "miner@attacker.com",
          existing: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }),
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.onTrialWalletLocked(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "already_blocked");
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
      });

      it("checks the paid guardrail before the age guardrail", async () => {
        const { service, wallet, userRepository } = setup({ email: "miner@attacker.com", hasPaidUser: true });

        await service.onTrialWalletLocked(wallet);

        expect(userRepository.hasEstablishedUserWithEmailDomain).not.toHaveBeenCalled();
      });

      it("asks for established accounts using the configured window", async () => {
        const { service, wallet, userRepository } = setup({ email: "miner@attacker.com", minAccountAgeDays: 45 });

        await service.onTrialWalletLocked(wallet);

        expect(userRepository.hasEstablishedUserWithEmailDomain).toHaveBeenCalledWith("attacker.com", 45);
      });
    });

    describe("in detect mode", () => {
      it("evaluates the guardrails but writes nothing and sweeps nothing", async () => {
        const { service, wallet, blockedEmailDomainRepository, jobQueueService, instrumentation, userRepository } = setup({
          email: "miner@attacker.com",
          mode: "detect",
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.onTrialWalletLocked(wallet);

        expect(userRepository.hasEstablishedUserWithEmailDomain).toHaveBeenCalled();
        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("dry_run");
      });
    });

    describe("sibling sweep", () => {
      it("enqueues one wipe per sibling, keyed by wallet", async () => {
        const { service, wallet, jobQueueService } = setup({
          email: "miner@attacker.com",
          siblings: [
            { walletId: 7, userId: "user-7" },
            { walletId: 9, userId: "user-9" }
          ]
        });

        await service.onTrialWalletLocked(wallet);

        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 9, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.9"
        });
      });

      it("excludes the wallet that triggered the block and bounds the query by the configured limit", async () => {
        const { service, wallet, userWalletRepository } = setup({ email: "miner@attacker.com", maxSiblings: 50 });

        await service.onTrialWalletLocked(wallet);

        expect(userWalletRepository.findLockableTrialWalletsByEmailDomain).toHaveBeenCalledWith("attacker.com", {
          excludeWalletId: wallet.id,
          limit: 50
        });
      });

      it("skips a sibling whose wipe is already queued", async () => {
        const { service, wallet, jobQueueService } = setup({
          email: "miner@attacker.com",
          siblings: [{ walletId: 7, userId: "user-7" }],
          pendingKeys: ["lockBlockedDomainWallet.7"]
        });

        await service.onTrialWalletLocked(wallet);

        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      });

      it("keeps enqueuing the rest when one sibling fails", async () => {
        const { service, wallet, jobQueueService, logger } = setup({
          email: "miner@attacker.com",
          siblings: [
            { walletId: 7, userId: "user-7" },
            { walletId: 9, userId: "user-9" }
          ]
        });
        jobQueueService.enqueue.mockRejectedValueOnce(new Error("queue unavailable"));

        await service.onTrialWalletLocked(wallet);

        expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_DOMAIN_SIBLING_ENQUEUE_FAILED", walletId: 7 }));
      });

      it("records reaching the sibling limit, because a match that broad needs a human", async () => {
        const { service, wallet, instrumentation } = setup({
          email: "miner@attacker.com",
          maxSiblings: 2,
          siblings: [
            { walletId: 7, userId: "user-7" },
            { walletId: 9, userId: "user-9" }
          ]
        });

        await service.onTrialWalletLocked(wallet);

        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("sibling_limit_reached");
      });

      it("does not record the limit when fewer siblings came back than the limit allows", async () => {
        const { service, wallet, instrumentation } = setup({ email: "miner@attacker.com", maxSiblings: 2, siblings: [{ walletId: 7, userId: "user-7" }] });

        await service.onTrialWalletLocked(wallet);

        expect(instrumentation.recordDomainBlock).not.toHaveBeenCalledWith("sibling_limit_reached");
      });
    });

    describe("when another pod blocked the domain first", () => {
      it("still sweeps the siblings", async () => {
        const { service, wallet, jobQueueService } = setup({ email: "miner@attacker.com", blockRaced: true, siblings: [{ walletId: 7, userId: "user-7" }] });

        await service.onTrialWalletLocked(wallet);

        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
      });
    });

    it("swallows and records a failure, so a wipe that already landed is never retried for this", async () => {
      const { service, wallet, logger, instrumentation } = setup({ email: "miner@attacker.com", lookupError: new Error("connection terminated") });

      await expect(service.onTrialWalletLocked(wallet)).resolves.toBeUndefined();

      expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("failed");
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "EMAIL_DOMAIN_AUTO_BLOCK_FAILED" }));
    });
  });

  function setup(input?: {
    email?: string | null;
    existing?: ReturnType<typeof createBlockedEmailDomain>;
    hasPaidUser?: boolean;
    hasEstablishedUser?: boolean;
    siblings?: Array<{ walletId: number; userId: string }>;
    pendingKeys?: string[];
    mode?: "detect" | "enforce";
    maxSiblings?: number;
    minAccountAgeDays?: number;
    blockRaced?: boolean;
    lookupError?: Error;
  }) {
    const wallet = createUserWallet({ isTrialing: true }) as WalletInitialized;
    const user = createUser({ id: wallet.userId, email: input?.email === undefined ? "miner@attacker.com" : (input.email as string) });

    const userRepository = mock<UserRepository>({
      findById: input?.lookupError ? vi.fn().mockRejectedValue(input.lookupError) : vi.fn().mockResolvedValue(user),
      hasEstablishedUserWithEmailDomain: vi.fn().mockResolvedValue(input?.hasEstablishedUser ?? false)
    });
    const userWalletRepository = mock<UserWalletRepository>({
      findLockableTrialWalletsByEmailDomain: vi.fn().mockResolvedValue(input?.siblings ?? [])
    });
    const stripeTransactionRepository = mock<StripeTransactionRepository>({
      hasPaidUserWithEmailDomain: vi.fn().mockResolvedValue(input?.hasPaidUser ?? false)
    });
    const blockedEmailDomainRepository = mock<BlockedEmailDomainRepository>({
      findByDomain: vi.fn().mockResolvedValue(input?.existing),
      blockIfAbsent: vi.fn().mockResolvedValue(input?.blockRaced ? undefined : createBlockedEmailDomain())
    });
    const blockedEmailDomainService = mock<BlockedEmailDomainService>();
    const jobQueueService = mock<JobQueueService>({
      findPendingSingletonKeys: vi.fn().mockResolvedValue(new Set(input?.pendingKeys ?? [])),
      enqueue: vi.fn().mockResolvedValue("job-id")
    });
    const config = mockConfigService<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_DOMAIN_BLOCK_MODE: input?.mode ?? "enforce",
      WORKLOAD_ABUSE_DOMAIN_BLOCK_MAX_SIBLINGS: input?.maxSiblings ?? 200,
      WORKLOAD_ABUSE_DOMAIN_BLOCK_MIN_ACCOUNT_AGE_DAYS: input?.minAccountAgeDays ?? 30
    });
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const service = new EmailDomainBlockService(
      userRepository,
      userWalletRepository,
      stripeTransactionRepository,
      blockedEmailDomainRepository,
      blockedEmailDomainService,
      jobQueueService,
      config,
      instrumentation,
      createLogger
    );

    return {
      service,
      wallet,
      user,
      userRepository,
      userWalletRepository,
      stripeTransactionRepository,
      blockedEmailDomainRepository,
      blockedEmailDomainService,
      jobQueueService,
      config,
      instrumentation,
      logger
    };
  }
});
