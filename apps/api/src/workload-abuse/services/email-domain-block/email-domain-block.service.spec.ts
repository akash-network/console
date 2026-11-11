import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { StripeTransactionRepository } from "@src/billing/repositories/stripe-transaction/stripe-transaction.repository";
import type { CreateLogger } from "@src/core";
import type { JobQueueService } from "@src/core";
import type { UserRepository } from "@src/user/repositories";
import type { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import type { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import type { BlockedEmailDomainService } from "@src/workload-abuse/services/blocked-email-domain/blocked-email-domain.service";
import { LockBlockedDomainWallet } from "@src/workload-abuse/services/lock-blocked-domain-wallet/lock-blocked-domain-wallet.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { DOMAIN_BLOCK_REASON, EmailDomainBlockService } from "./email-domain-block.service";

import { mockConfigService } from "@test/mocks/config-service.mock";
import { createBlockedEmailDomain } from "@test/seeders/blocked-email-domain.seeder";
import { createUser } from "@test/seeders/user.seeder";
import { createInitializedUserWallet } from "@test/seeders/user-wallet.seeder";

describe(EmailDomainBlockService.name, () => {
  describe("blockDomainOf", () => {
    it("blocks the domain of the wallet it was given", async () => {
      const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({ email: "miner@attacker.com" });

      await service.blockDomainOf(wallet);

      expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith({
        domain: "attacker.com",
        reason: DOMAIN_BLOCK_REASON,
        triggeredByUserId: wallet.userId
      });
      expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("blocked");
    });

    it("primes the lookup cache so the sweep does not wait out a stale negative", async () => {
      const { service, wallet, blockedEmailDomainService } = setup({ email: "miner@attacker.com" });

      await service.blockDomainOf(wallet);

      expect(blockedEmailDomainService.rememberBlocked).toHaveBeenCalledWith("attacker.com");
    });

    it("blocks the normalized domain of a mixed-case address", async () => {
      const { service, wallet, blockedEmailDomainRepository } = setup({ email: "Miner@Attacker.COM" });

      await service.blockDomainOf(wallet);

      expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ domain: "attacker.com" }));
    });

    describe("when the address is on a subdomain", () => {
      it("blocks the registrable domain and primes the lookup cache for it", async () => {
        const { service, wallet, blockedEmailDomainRepository, blockedEmailDomainService } = setup({ email: "miner@eu.mail.attacker.co.uk" });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith({
          domain: "attacker.co.uk",
          reason: DOMAIN_BLOCK_REASON,
          triggeredByUserId: wallet.userId
        });
        expect(blockedEmailDomainService.rememberBlocked).toHaveBeenCalledWith("attacker.co.uk");
      });

      it("evaluates every guardrail on the registrable domain", async () => {
        const { service, wallet, userRepository, stripeTransactionRepository, detectionRepository } = setup({
          email: "miner@mail.attacker.com",
          minAccountAgeDays: 45
        });

        await service.blockDomainOf(wallet);

        expect(stripeTransactionRepository.hasPaidUserWithEmailDomain).toHaveBeenCalledWith("attacker.com");
        expect(userRepository.hasEstablishedUserWithEmailDomain).toHaveBeenCalledWith("attacker.com", 45, wallet.userId);
        expect(detectionRepository.hasEnforcedSignatureMatchByAnotherMailbox).toHaveBeenCalledWith("attacker.com", wallet.userId);
      });

      it("sweeps the siblings on the registrable domain", async () => {
        const { service, wallet, userWalletRepository, jobQueueService } = setup({
          email: "miner@mail.attacker.com",
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

        expect(userWalletRepository.findLockableTrialWalletsByEmailDomain).toHaveBeenCalledWith("attacker.com", expect.anything());
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
      });

      it("skips as allowlisted when an operator allowed the address's own subdomain", async () => {
        const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({
          email: "someone@mail.customer.com",
          existing: createBlockedEmailDomain({ domain: "mail.customer.com", status: "allowed" })
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledTimes(1);
        expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("mail.customer.com");
        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "allowlisted");
      });

      it("skips as already blocked when the registrable domain is the nearest block, without a second lookup", async () => {
        const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({
          email: "miner@mail.attacker.com",
          existing: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" })
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledTimes(1);
        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "already_blocked");
      });

      it("still blocks the registrable domain when only the address's subdomain is blocked", async () => {
        const { service, wallet, blockedEmailDomainRepository } = setup({
          email: "miner@eu.mail.attacker.com",
          existing: createBlockedEmailDomain({ domain: "mail.attacker.com", status: "blocked" })
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenNthCalledWith(1, "eu.mail.attacker.com");
        expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenNthCalledWith(2, "attacker.com");
        expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ domain: "attacker.com" }));
      });

      it("skips as allowlisted when the registrable domain is allowed above a blocked subdomain", async () => {
        const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({
          email: "miner@eu.mail.customer.com",
          existing: createBlockedEmailDomain({ domain: "mail.customer.com", status: "blocked" }),
          registrableRule: createBlockedEmailDomain({ domain: "customer.com", status: "allowed" })
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "allowlisted");
      });

      it("logs the dry run with both the registrable domain and the address's domain", async () => {
        const { service, wallet, logger } = setup({ email: "miner@mail.attacker.com", mode: "detect" });

        await service.blockDomainOf(wallet);

        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ event: "EMAIL_DOMAIN_AUTO_BLOCK_DRY_RUN", domain: "attacker.com", emailDomain: "mail.attacker.com" })
        );
      });
    });

    describe("guardrails", () => {
      it("skips with no_domain when the wallet's owner no longer exists", async () => {
        const { service, wallet, instrumentation, logger } = setup({ userMissing: true });

        await service.blockDomainOf(wallet);

        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "no_domain");
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({ event: "EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED", reason: "no_domain", walletId: wallet.id, userId: wallet.userId })
        );
      });

      it.each([["miner@co.uk"], ["miner@github.io"]])("never blocks %s, whose domain is a public suffix", async email => {
        const { service, wallet, blockedEmailDomainRepository, instrumentation, logger } = setup({ email });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.findNearestRule).not.toHaveBeenCalled();
        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "public_suffix");
        expect(logger.info).toHaveBeenCalledWith(
          expect.objectContaining({
            event: "EMAIL_DOMAIN_AUTO_BLOCK_SKIPPED",
            reason: "public_suffix",
            emailDomain: email.split("@")[1],
            userId: wallet.userId
          })
        );
      });

      it("blocks a domain registered under a private suffix rather than the suffix", async () => {
        const { service, wallet, blockedEmailDomainRepository } = setup({ email: "miner@mail.attacker.github.io" });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ domain: "attacker.github.io" }));
      });

      it("skips an address on a subdomain of a public email provider", async () => {
        const { service, wallet, instrumentation } = setup({ email: "someone@mail.gmail.com" });

        await service.blockDomainOf(wallet);

        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "public_provider");
      });

      it.each([
        { reason: "no_domain", input: { email: null } },
        { reason: "public_provider", input: { email: "miner@gmail.com" } },
        { reason: "allowlisted", input: { existing: createBlockedEmailDomain({ domain: "attacker.com", status: "allowed" }) } },
        { reason: "domain_has_paid_user", input: { hasPaidUser: true } },
        { reason: "domain_predates_attack", input: { hasEstablishedUser: true } }
      ])("skips with $reason and writes nothing, even once another account on the domain is caught", async ({ reason, input }) => {
        const { service, wallet, blockedEmailDomainRepository, instrumentation } = setup({ email: "miner@attacker.com", anotherAccountCaught: true, ...input });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", reason);
      });

      it("does not sweep siblings of a domain an operator has allowed", async () => {
        const { service, wallet, jobQueueService } = setup({
          email: "miner@customer.com",
          existing: createBlockedEmailDomain({ domain: "customer.com", status: "allowed" }),
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      });

      it("sweeps siblings of a domain that is already blocked, because the first sweep can have missed one", async () => {
        const { service, wallet, blockedEmailDomainRepository, jobQueueService, instrumentation } = setup({
          email: "miner@attacker.com",
          existing: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" }),
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "already_blocked");
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
      });

      it("sweeps the siblings of the blocked parent domain when the address is on its subdomain", async () => {
        const { service, wallet, blockedEmailDomainRepository, userWalletRepository, instrumentation } = setup({
          email: "miner@mail.attacker.com",
          existing: createBlockedEmailDomain({ domain: "attacker.com", status: "blocked" })
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.findNearestRule).toHaveBeenCalledWith("mail.attacker.com");
        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "already_blocked");
        expect(userWalletRepository.findLockableTrialWalletsByEmailDomain).toHaveBeenCalledWith("attacker.com", expect.anything());
      });

      it("checks the paid guardrail before the age guardrail", async () => {
        const { service, wallet, userRepository } = setup({ email: "miner@attacker.com", hasPaidUser: true });

        await service.blockDomainOf(wallet);

        expect(userRepository.hasEstablishedUserWithEmailDomain).not.toHaveBeenCalled();
      });

      it("asks for established accounts using the configured window", async () => {
        const { service, wallet, userRepository } = setup({ email: "miner@attacker.com", minAccountAgeDays: 45 });

        await service.blockDomainOf(wallet);

        expect(userRepository.hasEstablishedUserWithEmailDomain).toHaveBeenCalledWith("attacker.com", 45, wallet.userId);
      });

      it("does not let the caught account vouch for its own domain", async () => {
        const { service, wallet, userRepository, blockedEmailDomainRepository } = setup({ email: "miner@attacker.com", hasEstablishedUser: false });

        await service.blockDomainOf(wallet);

        expect(userRepository.hasEstablishedUserWithEmailDomain).toHaveBeenCalledWith("attacker.com", expect.any(Number), wallet.userId);
        expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalled();
      });
    });

    describe("when no other account on the domain has been caught", () => {
      it("leaves the domain unblocked and its other trial wallets unlocked", async () => {
        const { service, wallet, blockedEmailDomainRepository, blockedEmailDomainService, jobQueueService, instrumentation } = setup({
          email: "miner@attacker.com",
          anotherAccountCaught: false,
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).not.toHaveBeenCalled();
        expect(blockedEmailDomainService.rememberBlocked).not.toHaveBeenCalled();
        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "awaiting_second_account");
      });

      it("records no dry run in detect mode", async () => {
        const { service, wallet, instrumentation } = setup({ email: "miner@attacker.com", anotherAccountCaught: false, mode: "detect" });

        await service.blockDomainOf(wallet);

        expect(instrumentation.recordDomainBlock).not.toHaveBeenCalledWith("dry_run");
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "awaiting_second_account");
      });
    });

    describe("when another account on the domain has been caught", () => {
      it("looks for it on the normalized domain, apart from the caught wallet's own user", async () => {
        const { service, wallet, detectionRepository } = setup({ email: "Miner@Attacker.COM" });

        await service.blockDomainOf(wallet);

        expect(detectionRepository.hasEnforcedSignatureMatchByAnotherMailbox).toHaveBeenCalledWith("attacker.com", wallet.userId);
      });

      it("blocks the domain and locks its other trial wallets", async () => {
        const { service, wallet, blockedEmailDomainRepository, jobQueueService } = setup({
          email: "miner@attacker.com",
          anotherAccountCaught: true,
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainRepository.blockIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ domain: "attacker.com" }));
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
      });
    });

    describe("in detect mode", () => {
      it("evaluates the guardrails but writes nothing and sweeps nothing", async () => {
        const { service, wallet, blockedEmailDomainRepository, jobQueueService, instrumentation, userRepository } = setup({
          email: "miner@attacker.com",
          mode: "detect",
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

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

        await service.blockDomainOf(wallet);

        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 9, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.9"
        });
      });

      it("excludes the wallet that triggered the block and bounds the query by the configured limit", async () => {
        const { service, wallet, userWalletRepository } = setup({ email: "miner@attacker.com", maxSiblings: 50 });

        await service.blockDomainOf(wallet);

        expect(userWalletRepository.findLockableTrialWalletsByEmailDomain).toHaveBeenCalledWith("attacker.com", {
          excludeWalletId: wallet.id,
          limit: 51
        });
      });

      it("skips a sibling whose wipe is already queued", async () => {
        const { service, wallet, jobQueueService } = setup({
          email: "miner@attacker.com",
          siblings: [{ walletId: 7, userId: "user-7" }],
          pendingKeys: ["lockBlockedDomainWallet.7"]
        });

        await service.blockDomainOf(wallet);

        expect(jobQueueService.enqueue).not.toHaveBeenCalled();
      });

      it("keeps enqueuing the rest when one sibling fails, then rethrows so the sweep is retried", async () => {
        const { service, wallet, jobQueueService, logger } = setup({
          email: "miner@attacker.com",
          siblings: [
            { walletId: 7, userId: "user-7" },
            { walletId: 9, userId: "user-9" }
          ]
        });
        jobQueueService.enqueue.mockRejectedValueOnce(new Error("queue unavailable"));

        await expect(service.blockDomainOf(wallet)).rejects.toThrow("queue unavailable");

        expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 9, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.9"
        });
        expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_DOMAIN_SIBLING_ENQUEUE_FAILED", walletId: 7 }));
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_DOMAIN_SIBLINGS_SWEPT", enqueued: 1, failed: 1 }));
      });

      it("records reaching the sibling limit, because a match that broad needs a human", async () => {
        const { service, wallet, instrumentation, jobQueueService } = setup({
          email: "miner@attacker.com",
          maxSiblings: 2,
          siblings: [
            { walletId: 7, userId: "user-7" },
            { walletId: 9, userId: "user-9" },
            { walletId: 11, userId: "user-11" }
          ]
        });

        await service.blockDomainOf(wallet);

        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("sibling_limit_reached");
        expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
        expect(jobQueueService.enqueue).not.toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 11, domain: "attacker.com" }), expect.anything());
      });

      it("leaves the limit unrecorded for a domain holding exactly as many siblings as the limit allows", async () => {
        const { service, wallet, instrumentation, jobQueueService } = setup({
          email: "miner@attacker.com",
          maxSiblings: 2,
          siblings: [
            { walletId: 7, userId: "user-7" },
            { walletId: 9, userId: "user-9" }
          ]
        });

        await service.blockDomainOf(wallet);

        expect(instrumentation.recordDomainBlock).not.toHaveBeenCalledWith("sibling_limit_reached");
        expect(jobQueueService.enqueue).toHaveBeenCalledTimes(2);
      });

      it("does not record the limit when fewer siblings came back than the limit allows", async () => {
        const { service, wallet, instrumentation } = setup({ email: "miner@attacker.com", maxSiblings: 2, siblings: [{ walletId: 7, userId: "user-7" }] });

        await service.blockDomainOf(wallet);

        expect(instrumentation.recordDomainBlock).not.toHaveBeenCalledWith("sibling_limit_reached");
      });
    });

    describe("when another pod wrote the row first", () => {
      it("still sweeps the siblings", async () => {
        const { service, wallet, jobQueueService } = setup({
          email: "miner@attacker.com",
          raceWinner: "blocked",
          siblings: [{ walletId: 7, userId: "user-7" }]
        });

        await service.blockDomainOf(wallet);

        expect(jobQueueService.enqueue).toHaveBeenCalledWith(new LockBlockedDomainWallet({ walletId: 7, domain: "attacker.com" }), {
          singletonKey: "lockBlockedDomainWallet.7"
        });
      });

      it("primes the lookup cache with the block that won, so signups on this pod stop waiting out a stale negative", async () => {
        const { service, wallet, blockedEmailDomainService, instrumentation, logger } = setup({ email: "miner@attacker.com", raceWinner: "blocked" });

        await service.blockDomainOf(wallet);

        expect(blockedEmailDomainService.rememberBlocked).toHaveBeenCalledWith("attacker.com");
        expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("raced");
        expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "EMAIL_DOMAIN_AUTO_BLOCK_RACED", domain: "attacker.com" }));
      });

      it.each([{ raceWinner: "allowed" as const }, { raceWinner: "gone" as const }])(
        "leaves the domain alone when the row that won is $raceWinner",
        async ({ raceWinner }) => {
          const { service, wallet, blockedEmailDomainService, jobQueueService, instrumentation } = setup({
            email: "miner@attacker.com",
            raceWinner,
            siblings: [{ walletId: 7, userId: "user-7" }]
          });

          await service.blockDomainOf(wallet);

          expect(blockedEmailDomainService.rememberBlocked).not.toHaveBeenCalled();
          expect(jobQueueService.enqueue).not.toHaveBeenCalled();
          expect(instrumentation.recordDomainBlock).toHaveBeenCalledWith("skipped", "allowlisted");
        }
      );
    });

    it("lets a failure through, so the queue retries the block rather than losing it", async () => {
      const { service, wallet } = setup({ email: "miner@attacker.com", lookupError: new Error("connection terminated") });

      await expect(service.blockDomainOf(wallet)).rejects.toThrow("connection terminated");
    });
  });

  function setup(input?: {
    email?: string | null;
    existing?: ReturnType<typeof createBlockedEmailDomain>;
    registrableRule?: ReturnType<typeof createBlockedEmailDomain>;
    hasPaidUser?: boolean;
    hasEstablishedUser?: boolean;
    anotherAccountCaught?: boolean;
    siblings?: Array<{ walletId: number; userId: string }>;
    pendingKeys?: string[];
    mode?: "detect" | "enforce";
    maxSiblings?: number;
    minAccountAgeDays?: number;
    raceWinner?: "blocked" | "allowed" | "gone";
    lookupError?: Error;
    userMissing?: boolean;
  }) {
    const raceWinner =
      input?.raceWinner && input.raceWinner !== "gone" ? createBlockedEmailDomain({ domain: "attacker.com", status: input.raceWinner }) : undefined;
    const wallet = createInitializedUserWallet({ isTrialing: true });
    const user = createUser({ id: wallet.userId, email: input?.email === undefined ? "miner@attacker.com" : (input.email as string) });

    const userRepository = mock<UserRepository>({
      findById: input?.lookupError ? vi.fn().mockRejectedValue(input.lookupError) : vi.fn().mockResolvedValue(input?.userMissing ? undefined : user),
      hasEstablishedUserWithEmailDomain: vi.fn().mockResolvedValue(input?.hasEstablishedUser ?? false)
    });
    const userWalletRepository = mock<UserWalletRepository>({
      findLockableTrialWalletsByEmailDomain: vi.fn().mockResolvedValue(input?.siblings ?? [])
    });
    const stripeTransactionRepository = mock<StripeTransactionRepository>({
      hasPaidUserWithEmailDomain: vi.fn().mockResolvedValue(input?.hasPaidUser ?? false)
    });
    const blockedEmailDomainRepository = mock<BlockedEmailDomainRepository>({
      findNearestRule: vi.fn().mockResolvedValueOnce(input?.existing).mockResolvedValue(input?.registrableRule),
      findByDomain: vi.fn().mockResolvedValue(raceWinner),
      blockIfAbsent: vi.fn().mockResolvedValue(input?.raceWinner ? undefined : createBlockedEmailDomain())
    });
    const blockedEmailDomainService = mock<BlockedEmailDomainService>();
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>({
      hasEnforcedSignatureMatchByAnotherMailbox: vi.fn().mockResolvedValue(input?.anotherAccountCaught ?? true)
    });
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
      detectionRepository,
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
      detectionRepository,
      jobQueueService,
      config,
      instrumentation,
      logger
    };
  }
});
