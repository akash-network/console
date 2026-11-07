import type { HttpClient } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateLogger } from "@src/core";
import type { UserOutput, UserRepository } from "@src/user/repositories";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { ReviewTrialSignup, ReviewTrialSignupHandler, reviewTrialSignupKeyFor } from "./review-trial-signup.handler";
import { buildTrialSignupReviewMessage } from "./trial-signup-review-message";

import { createUser } from "@test/seeders/user.seeder";
import { mockConfig } from "@test/services/mock-config.service";

const WEBHOOK_URL = "https://hooks.slack.test/review";
const ADMIN_URL = "https://console-admin.example.com";

describe(ReviewTrialSignupHandler.name, () => {
  it("accepts the review job under a stable name", () => {
    const job = new ReviewTrialSignup({ userId: "user-1" });

    expect(job).toMatchObject({ name: "ReviewTrialSignup", version: 1, data: { userId: "user-1" } });
    expect(reviewTrialSignupKeyFor("user-1")).toBe("reviewTrialSignup.user-1");
  });

  it("declares no permissions and names its logger after itself", () => {
    const { handler, createLogger } = setup();

    expect(handler.accepts).toBe(ReviewTrialSignup);
    expect(handler.requiresPermission()).toEqual([]);
    expect(createLogger).toHaveBeenCalledWith({ context: ReviewTrialSignupHandler.name });
  });

  it("flags the sign-up with its linked accounts and posts it for review", async () => {
    const { handler, user, linkedAccounts, userRepository, logger, slackWebhookClient } = setup();

    await handler.handle({ userId: user.id, version: 1 });

    expect(userRepository.findRecentlyActiveByFingerprint).toHaveBeenCalledWith(user.lastFingerprint, user.id, 45);
    expect(logger.warn).toHaveBeenCalledWith({
      event: "TRIAL_SIGNUP_FLAGGED_FOR_REVIEW",
      userId: user.id,
      linkedUserIds: linkedAccounts.map(account => account.id)
    });
    expect(slackWebhookClient.post).toHaveBeenCalledWith(WEBHOOK_URL, buildTrialSignupReviewMessage({ account: user, linkedAccounts, adminUrl: ADMIN_URL }));
  });

  it("flags the sign-up without posting when no review channel is configured", async () => {
    const { handler, user, logger, slackWebhookClient } = setup({ webhookUrl: undefined });

    await handler.handle({ userId: user.id, version: 1 });

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({ event: "TRIAL_SIGNUP_FLAGGED_FOR_REVIEW" }));
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
  });

  it("does not flag a sign-up without linked accounts", async () => {
    const { handler, user, logger, slackWebhookClient } = setup({ linkedAccounts: [] });

    await handler.handle({ userId: user.id, version: 1 });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
  });

  it("reviews nothing while the review window is not configured", async () => {
    const { handler, user, userRepository, slackWebhookClient } = setup({ windowMinutes: undefined });

    await handler.handle({ userId: user.id, version: 1 });

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
  });

  it("skips a user who is gone or carries nothing to compare", async () => {
    const gone = setup({ user: null });
    const blank = setup({ user: createUser({ lastFingerprint: null }) });

    await gone.handler.handle({ userId: gone.user.id, version: 1 });
    await blank.handler.handle({ userId: blank.user.id, version: 1 });

    expect(gone.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
    expect(blank.userRepository.findRecentlyActiveByFingerprint).not.toHaveBeenCalled();
  });

  it("lets a rejected post fail the job so the queue retries it", async () => {
    const { handler, user, slackWebhookClient } = setup();
    slackWebhookClient.post.mockRejectedValue(new Error("Slack webhook answered 500"));

    await expect(handler.handle({ userId: user.id, version: 1 })).rejects.toThrow("Slack webhook answered 500");
  });

  function setup(input: { user?: UserOutput | null; linkedAccounts?: Pick<UserOutput, "id" | "email">[]; windowMinutes?: number; webhookUrl?: string } = {}) {
    const user = input.user ?? createUser({ lastFingerprint: faker.string.hexadecimal({ length: 64 }) });
    const linkedAccounts = input.linkedAccounts ?? [{ id: faker.string.uuid(), email: faker.internet.email() }];
    const userRepository = mock<UserRepository>({
      findById: vi.fn().mockResolvedValue(input.user === null ? undefined : user),
      findRecentlyActiveByFingerprint: vi.fn().mockResolvedValue(linkedAccounts)
    });
    const workloadAbuseConfig = mockConfig<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNUP_REVIEW_WINDOW_MINUTES: "windowMinutes" in input ? input.windowMinutes : 45,
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: "webhookUrl" in input ? input.webhookUrl : WEBHOOK_URL
    });
    const billingConfig = mockConfig<BillingConfigService>({ CONSOLE_ADMIN_URL: ADMIN_URL });
    const slackWebhookClient = mock<HttpClient>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new ReviewTrialSignupHandler(userRepository, workloadAbuseConfig, billingConfig, slackWebhookClient, createLogger);

    return { handler, user, linkedAccounts, userRepository, slackWebhookClient, logger, createLogger };
  }
});
