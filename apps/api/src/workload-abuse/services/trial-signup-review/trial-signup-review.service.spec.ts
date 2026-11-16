import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { JobQueueService } from "@src/core";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import { ReviewTrialSignup, reviewTrialSignupKeyFor } from "@src/workload-abuse/services/review-trial-signup/review-trial-signup.handler";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { TrialSignupReviewService } from "./trial-signup-review.service";

import { createUser } from "@test/seeders/user.seeder";
import { mockConfig } from "@test/services/mock-config.service";

describe(TrialSignupReviewService.name, () => {
  it("queues a linked sign-up for review once per device and window", async () => {
    const { service, user, fingerprint, userRepository, jobQueueService } = setup({ linkedCount: 1 });

    await service.flagIfLinked(user);

    expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalledWith(fingerprint, user.id, 45);
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new ReviewTrialSignup({ userId: user.id }), {
      singletonKey: reviewTrialSignupKeyFor(fingerprint),
      singletonSeconds: 45 * 60
    });
  });

  it("queues nothing for a sign-up without linked accounts", async () => {
    const { service, user, jobQueueService } = setup({ linkedCount: 0 });

    await service.flagIfLinked(user);

    expect(jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  it("looks nothing up without a review window or without a fingerprint", async () => {
    const noWindow = setup({ linkedCount: 1, windowMinutes: undefined });
    const noFingerprint = setup({ linkedCount: 1, user: createUser({ lastFingerprint: null }) });

    await noWindow.service.flagIfLinked(noWindow.user);
    await noFingerprint.service.flagIfLinked(noFingerprint.user);

    expect(noWindow.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(noFingerprint.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(noWindow.jobQueueService.enqueue).not.toHaveBeenCalled();
    expect(noFingerprint.jobQueueService.enqueue).not.toHaveBeenCalled();
  });

  function setup(input: { linkedCount: number; windowMinutes?: number; user?: UserOutput }) {
    const fingerprint = faker.string.hexadecimal({ length: 64 });
    const user = input.user ?? createUser({ lastFingerprint: fingerprint });
    const linkedAccounts = Array.from({ length: input.linkedCount }, () => ({ id: faker.string.uuid(), email: faker.internet.email() }));
    const userRepository = mock<UserRepository>({ findRecentlyActiveByFingerprint: vi.fn().mockResolvedValue(linkedAccounts) });
    const jobQueueService = mock<JobQueueService>({ enqueue: vi.fn().mockResolvedValue("job-id") });
    const config = mockConfig<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "windowMinutes" in input ? input.windowMinutes : 45
    });
    const service = new TrialSignupReviewService(userRepository, jobQueueService, config);

    return { service, user, fingerprint, userRepository, jobQueueService };
  }
});
