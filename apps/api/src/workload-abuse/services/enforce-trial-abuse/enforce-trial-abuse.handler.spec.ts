import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { CreateLogger } from "@src/core";
import type { WorkloadAbuseDetectionRepository } from "@src/workload-abuse/repositories/workload-abuse-detection/workload-abuse-detection.repository";
import type { TrialAbuseEnforcementService } from "@src/workload-abuse/services/trial-abuse-enforcement/trial-abuse-enforcement.service";
import type { WorkloadAbuseInstrumentationService } from "@src/workload-abuse/services/workload-abuse-instrumentation/workload-abuse-instrumentation.service";
import { EnforceTrialAbuseHandler, enforceTrialAbuseKeyFor } from "./enforce-trial-abuse.handler";

import { createUserWallet } from "@test/seeders/user-wallet.seeder";

const PAYLOAD = { walletId: 42, detectionId: "detection-1", version: 1 as const };

describe(EnforceTrialAbuseHandler.name, () => {
  it("keys the wipe by wallet", () => {
    expect(enforceTrialAbuseKeyFor(7)).toBe("enforceTrialAbuse.7");
  });

  it("wipes a trial wallet that is not locked yet", async () => {
    const { handler, wallet, enforcementService } = setup({ wallet: createUserWallet({ isTrialing: true }) });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).toHaveBeenCalledWith({ wallet, detectionId: PAYLOAD.detectionId });
  });

  it("marks the detection enforced without acting again when the wallet is already locked", async () => {
    const { handler, enforcementService, detectionRepository, instrumentation } = setup({
      wallet: createUserWallet({ isTrialing: false, abuseLockedAt: new Date() })
    });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).not.toHaveBeenCalled();
    expect(detectionRepository.updateById).toHaveBeenCalledWith(PAYLOAD.detectionId, { action: "enforced", updatedAt: expect.any(Date) });
    expect(instrumentation.recordEnforcement).toHaveBeenCalledWith("skipped");
  });

  it("leaves a wallet that has since paid alone", async () => {
    const { handler, enforcementService, logger } = setup({ wallet: createUserWallet({ isTrialing: false }) });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_WORKLOAD_ABUSE_ENFORCEMENT_SKIPPED", reason: "NOT_TRIALING" }));
  });

  it("skips a wallet it cannot find", async () => {
    const { handler, enforcementService, logger } = setup({ wallet: null });

    await handler.handle(PAYLOAD);

    expect(enforcementService.enforce).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ reason: "WALLET_NOT_FOUND" }));
  });

  it("declares no permissions for its execution", () => {
    const { handler } = setup({ wallet: null });

    expect(handler.requiresPermission()).toEqual([]);
  });

  function setup(input: { wallet: ReturnType<typeof createUserWallet> | null }) {
    const userWalletRepository = mock<UserWalletRepository>();
    userWalletRepository.findById.mockResolvedValue(input.wallet ?? undefined);
    const detectionRepository = mock<WorkloadAbuseDetectionRepository>();
    const enforcementService = mock<TrialAbuseEnforcementService>();
    const instrumentation = mock<WorkloadAbuseInstrumentationService>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);

    const handler = new EnforceTrialAbuseHandler(userWalletRepository, detectionRepository, enforcementService, instrumentation, createLogger);

    return { handler, wallet: input.wallet!, userWalletRepository, detectionRepository, enforcementService, instrumentation, logger };
  }
});
