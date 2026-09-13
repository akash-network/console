import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger, JobQueueService } from "@src/core";
import type { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import { BlockEmailDomainOfWallet } from "@src/workload-abuse/services/block-email-domain-of-wallet/block-email-domain-of-wallet.handler";
import type { EnforcementOutcome, TrialAbuseEnforcementService } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { EnforceTrialAbuseHandler, enforceTrialAbuseKeyFor } from "./enforce-trial-abuse.handler";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYLOAD = { walletId: 42, detectionId: "detection-1", version: 1 as const };
const WIPED: EnforcementOutcome = { depositGrantRevoked: true, feeGrantRevoked: true, closedDseqs: ["123"] };

describe(EnforceTrialAbuseHandler.name, () => {
  it("keys the wipe by wallet", () => {
    expect(enforceTrialAbuseKeyFor(7)).toBe("enforceTrialAbuse.7");
  });

  it("wipes a trial wallet that is not locked yet", async () => {
    const { handler, wallet, enforcementService } = setup({ wallet: createUserWallet({ isTrialing: true }) });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).toHaveBeenCalledWith({ wallet, detectionId: PAYLOAD.detectionId });
  });

  it("queues the email domain block of a wallet it wiped rather than running it inline", async () => {
    const { handler, jobQueueService } = setup({ wallet: createUserWallet({ isTrialing: true }) });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new BlockEmailDomainOfWallet({ walletId: PAYLOAD.walletId }), {
      singletonKey: "blockEmailDomainOfWallet.42"
    });
  });

  it("leaves the email domain alone when the wipe was skipped because the wallet paid", async () => {
    const { handler, jobQueueService } = setup({ wallet: createUserWallet({ isTrialing: true }), enforcementOutcome: null });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("fails the job when the domain block cannot be queued, so the retry picks it up", async () => {
    const { handler, jobQueueService } = setup({ wallet: createUserWallet({ isTrialing: true }) });
    jobQueueService.enqueue.mockRejectedValue(new Error("queue unavailable"));

    await expect(handler.handle(PAYLOAD)).rejects.toThrow("queue unavailable");
  });

  it("settles the wallet's detections without acting again when the wallet is already locked", async () => {
    const { handler, enforcementService, detectionRepository, instrumentation } = setup({
      wallet: createUserWallet({ isTrialing: false, abuseLockedAt: new Date() })
    });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).not.toHaveBeenCalled();
    expect(detectionRepository.markWalletEnforced).toHaveBeenCalledWith(PAYLOAD.walletId);
    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("skipped");
  });

  it("resumes the domain block of a wallet an interrupted run had already locked", async () => {
    const { handler, jobQueueService } = setup({ wallet: createUserWallet({ isTrialing: false, abuseLockedAt: new Date() }) });

    await handler.handle(PAYLOAD);

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new BlockEmailDomainOfWallet({ walletId: PAYLOAD.walletId }), {
      singletonKey: "blockEmailDomainOfWallet.42"
    });
  });

  it("leaves a wallet that has since paid alone", async () => {
    const { handler, enforcementService, jobQueueService, logger } = setup({ wallet: createUserWallet({ isTrialing: false }) });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_SKIPPED", reason: "NOT_TRIALING" }));
  });

  it("skips a wallet it cannot find", async () => {
    const { handler, enforcementService, jobQueueService, logger } = setup({ wallet: null });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ reason: "WALLET_NOT_FOUND" }));
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({ wallet: null });

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { wallet: ReturnType<typeof createUserWallet> | null; enforcementOutcome?: EnforcementOutcome | null }) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findById.mockResolvedValue(input.wallet ?? undefined);
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>();
    const enforcementService = mock<TrialAbuseEnforcementService>({
      enforce: vi.fn().mockResolvedValue(input.enforcementOutcome === undefined ? WIPED : input.enforcementOutcome)
    });
    const jobQueueService = mock<JobQueueService>({ enqueue: vi.fn().mockResolvedValue("job-id") });
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new EnforceTrialAbuseHandler(userWalletRepository, detectionRepository, enforcementService, jobQueueService, instrumentation, createLogger);

    return {
      handler,
      wallet: input.wallet!,
      userWalletRepository,
      detectionRepository,
      enforcementService,
      jobQueueService,
      instrumentation,
      logger
    };
  }
});
