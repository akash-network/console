import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { BlockedEmailDomainRepository } from "@src/workload-abuse/repositories/blocked-email-domain/blocked-email-domain.repository";
import type { EnforcementOutcome, TrialAbuseEnforcementService } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { LockBlockedDomainWalletHandler, lockBlockedDomainWalletKeyFor } from "./lock-blocked-domain-wallet.handler";

import { createBlockedEmailDomain } from "@test/seeders/blocked-email-domain.seeder";
import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYLOAD = { walletId: 42, domain: "attacker.com", version: 1 as const };
const WIPED: EnforcementOutcome = { depositGrantRevoked: true, feeGrantRevoked: true, closedDseqs: ["123"] };

describe(LockBlockedDomainWalletHandler.name, () => {
  it("keys the wipe by wallet, so two sweeps of one domain do not suppress each other", () => {
    expect(lockBlockedDomainWalletKeyFor(7)).toBe("lockBlockedDomainWallet.7");
  });

  it("wipes a trialing wallet with the blocked-domain reason", async () => {
    const { handler, wallet, enforcementService } = setup({ wallet: createUserWallet({ isTrialing: true }) });

    await handler.handle(PAYLOAD);

    expect(enforcementService.wipeTrialWallet).toHaveBeenCalledWith(wallet, "blocked_domain");
  });

  it("records the wipe it performed", async () => {
    const { handler, instrumentation, logger } = setup({ wallet: createUserWallet({ isTrialing: true }) });

    await handler.handle(PAYLOAD);

    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("enforced");
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_DOMAIN_WALLET_LOCKED", walletId: PAYLOAD.walletId }));
  });

  it.each([
    { reason: "WALLET_NOT_FOUND", input: { wallet: null } },
    { reason: "ALREADY_LOCKED", input: { wallet: createUserWallet({ isTrialing: true, abuseLockedAt: new Date() }) } },
    { reason: "NOT_TRIALING", input: { wallet: createUserWallet({ isTrialing: false }) } },
    { reason: "DOMAIN_NOT_BLOCKED", input: { wallet: createUserWallet({ isTrialing: true }), blockedDomain: null } }
  ])("skips with $reason without wiping", async ({ reason, input }) => {
    const { handler, enforcementService, instrumentation, logger } = setup(input);

    await handler.handle(PAYLOAD);

    expect(enforcementService.wipeTrialWallet).not.toHaveBeenCalled();
    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("skipped");
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_DOMAIN_WALLET_LOCK_SKIPPED", reason }));
  });

  it("leaves a domain an operator has allowed since the sweep started", async () => {
    const { handler, enforcementService, logger } = setup({
      wallet: createUserWallet({ isTrialing: true }),
      blockedDomain: createBlockedEmailDomain({ domain: "attacker.com", status: "allowed" })
    });

    await handler.handle(PAYLOAD);

    expect(enforcementService.wipeTrialWallet).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "BLOCKED_DOMAIN_WALLET_LOCK_SKIPPED", reason: "DOMAIN_NOT_BLOCKED" }));
  });

  it("reads the domain row rather than a cached verdict", async () => {
    const { handler, blockedEmailDomainRepository } = setup({ wallet: createUserWallet({ isTrialing: true }) });

    await handler.handle(PAYLOAD);

    expect(blockedEmailDomainRepository.findByDomain).toHaveBeenCalledWith("attacker.com");
  });

  it("records a skip when the wallet paid between the sweep and the wipe", async () => {
    const { handler, logger, instrumentation } = setup({ wallet: createUserWallet({ isTrialing: true }), enforcementOutcome: null });

    await handler.handle(PAYLOAD);

    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("skipped");
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ reason: "PAID_DURING_ENFORCEMENT" }));
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({ wallet: null });

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: {
    wallet: ReturnType<typeof createUserWallet> | null;
    blockedDomain?: ReturnType<typeof createBlockedEmailDomain> | null;
    enforcementOutcome?: EnforcementOutcome | null;
  }) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findById.mockResolvedValue(input.wallet ?? undefined);
    const blockedEmailDomainRepository = mock<BlockedEmailDomainRepository>({
      findByDomain: vi
        .fn()
        .mockResolvedValue(
          input.blockedDomain === undefined ? createBlockedEmailDomain({ domain: PAYLOAD.domain, status: "blocked" }) : input.blockedDomain ?? undefined
        )
    });
    const enforcementService = mock<TrialAbuseEnforcementService>({
      wipeTrialWallet: vi.fn().mockResolvedValue(input.enforcementOutcome === undefined ? WIPED : input.enforcementOutcome)
    });
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new LockBlockedDomainWalletHandler(userWalletRepository, blockedEmailDomainRepository, enforcementService, instrumentation, createLogger);

    return { handler, wallet: input.wallet!, userWalletRepository, blockedEmailDomainRepository, enforcementService, instrumentation, logger };
  }
});
