import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { CreateLogger, JobQueueService } from "@src/core";
import type { TxService } from "@src/core/services/tx/tx.service";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { reviewHeldTrialSignupKeyFor, ReviewTrialSignup } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialSignupHoldService } from "./trial-signup-hold.service";

import { createUser } from "@test/seeders/user.seeder";
import { mockConfig } from "@test/services/mock-config.service";

describe(TrialSignupHoldService.name, () => {
  it("names its logger after itself", () => {
    const { createLogger } = setup();

    expect(createLogger).toHaveBeenCalledWith({ context: TrialSignupHoldService.name });
  });

  it("holds a trial once the linked accounts reach the threshold and reports it outside the transaction once per window", async () => {
    const { service, user, linkedAccounts, userRepository, jobQueueService, txService, logger } = setup({ mode: "enforce", linkedCount: 2 });

    const held = await service.isHeld(user);

    expect(held).toBe(true);
    expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalledWith(user.lastFingerprint, user.id, 45);
    expect(logger.warn).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HELD", userId: user.id, linkedUserIds: linkedAccounts.map(account => account.id) });
    expect(txService.outsideTransaction).toHaveBeenCalledTimes(1);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewTrialSignup({ userId: user.id, held: true }), {
      singletonKey: reviewHeldTrialSignupKeyFor(user.id),
      singletonSeconds: 45 * 60
    });
  });

  it("does not hold a trial while the linked accounts stay below the threshold", async () => {
    const { service, user, jobQueueService, logger } = setup({ mode: "enforce", linkedCount: 1 });

    expect(await service.isHeld(user)).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("follows the configured threshold", async () => {
    const { service, user } = setup({ mode: "enforce", linkedCount: 2, minLinkedAccounts: 3 });

    expect(await service.isHeld(user)).toBe(false);
  });

  it("only logs the hold it would have placed in report mode", async () => {
    const { service, user, linkedAccounts, jobQueueService, logger } = setup({ mode: "report", linkedCount: 2 });

    const held = await service.isHeld(user);

    expect(held).toBe(false);
    expect(logger.info).toHaveBeenCalledWith({
      event: "TRIAL_SIGNUP_HOLD_DRY_RUN",
      userId: user.id,
      linkedUserIds: linkedAccounts.map(account => account.id)
    });
    expect(logger.warn).not.toHaveBeenCalled();
    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("looks nothing up when off, without a review window or without a fingerprint", async () => {
    const off = setup({ mode: "off", linkedCount: 2 });
    const noWindow = setup({ mode: "enforce", linkedCount: 2, windowMinutes: undefined });
    const noFingerprint = setup({ mode: "enforce", linkedCount: 2, user: createUser({ lastFingerprint: null }) });

    expect(await off.service.isHeld(off.user)).toBe(false);
    expect(await noWindow.service.isHeld(noWindow.user)).toBe(false);
    expect(await noFingerprint.service.isHeld(noFingerprint.user)).toBe(false);
    expect(off.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(noWindow.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(noFingerprint.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
  });

  it("still holds the trial when the report cannot be queued", async () => {
    const { service, user, jobQueueService, logger } = setup({ mode: "enforce", linkedCount: 2 });
    const error = new Error("queue unavailable");
    jobQueueService.enqueue.mockRejectedValue(error);

    const held = await service.isHeld(user);

    expect(held).toBe(true);
    expect(logger.error).toHaveBeenCalledWith({ event: "TRIAL_SIGNUP_HOLD_REPORT_FAILED", userId: user.id, error });
  });

  function setup(
    input: {
      mode?: "off" | "report" | "enforce";
      linkedCount?: number;
      minLinkedAccounts?: number;
      windowMinutes?: number;
      user?: UserOutput;
    } = {}
  ) {
    const user = input.user ?? createUser({ lastFingerprint: faker.string.hexadecimal({ length: 64 }) });
    const linkedAccounts = Array.from({ length: input.linkedCount ?? 0 }, () => ({ id: faker.string.uuid(), email: faker.internet.email() }));
    const userRepository = mock<UserRepository>({ findRecentlyActiveByFingerprint: vi.fn().mockResolvedValue(linkedAccounts) });
    const jobQueueService = mock<JobQueueService>({ enqueue: vi.fn().mockResolvedValue("job-id") });
    const txService = mock<TxService>({ outsideTransaction: vi.fn(async cb => await cb()) });
    const config = mockConfig<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNUP_HOLD_MODE: input.mode ?? "report",
      WORKLOAD_ABUSE_SIGNUP_HOLD_MIN_LINKED_ACCOUNTS: input.minLinkedAccounts ?? 2,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "windowMinutes" in input ? input.windowMinutes : 45
    });
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const service = new TrialSignupHoldService(userRepository, jobQueueService, txService, config, createLogger);

    return { service, user, linkedAccounts, userRepository, jobQueueService, txService, logger, createLogger };
  }
});
