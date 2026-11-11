import type { HttpClient } from "@akashnetwork/http-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { UserWalletRepository } from "@src/billing/repositories";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import type { CreateLogger } from "@src/core";
import type { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import type { CreatedAccount, UserRepository } from "@src/user/repositories";
import type { WorkloadAbuseConfigService } from "@src/workload-abuse/services/workload-abuse-config/workload-abuse-config.service";
import { DailySignupSummaryHandler, dailySignupSummaryKeyFor, nextDailySignupSummaryAt, PostDailySignupSummary } from "./daily-signup-summary.handler";
import { buildDailySignupSummaryMessage } from "./daily-signup-summary-message";

import { mockConfig } from "@test/services/mock-config.service";

const WEBHOOK_URL = "https://hooks.slack.test/review";
const ADMIN_URL = "https://console-admin.example.com";
const WINDOW_STARTS_AT = "2026-11-09T13:00:00.000Z";
const WINDOW_ENDS_AT = "2026-11-10T13:00:00.000Z";
const NEXT_WINDOW_ENDS_AT = "2026-11-11T13:00:00.000Z";

describe(DailySignupSummaryHandler.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts the summary job under a stable name and keys it by day", () => {
    const job = new PostDailySignupSummary({ windowEndsAt: WINDOW_ENDS_AT });

    expect(job).toMatchObject({ name: "PostDailySignupSummary", version: 1, data: { windowEndsAt: WINDOW_ENDS_AT } });
    expect(dailySignupSummaryKeyFor(new Date(WINDOW_ENDS_AT))).toBe("dailySignupSummary.2026-11-10");
  });

  it("runs next at the configured hour today, or tomorrow once that hour has come", () => {
    expect(nextDailySignupSummaryAt(new Date("2026-11-10T12:59:59.000Z"), 13)).toEqual(new Date("2026-11-10T13:00:00.000Z"));
    expect(nextDailySignupSummaryAt(new Date("2026-11-10T13:00:00.000Z"), 13)).toEqual(new Date("2026-11-11T13:00:00.000Z"));
    expect(nextDailySignupSummaryAt(new Date("2026-12-31T23:30:00.000Z"), 0)).toEqual(new Date("2027-01-01T00:00:00.000Z"));
  });

  it("keeps one summary per day in the queue, declares no permissions and names its logger after itself", () => {
    const { handler, createLogger } = setup();

    expect(handler.accepts).toBe(PostDailySignupSummary);
    expect(handler.policy).toBe("exclusive");
    expect(handler.requiresPermission()).toEqual([]);
    expect(createLogger).toHaveBeenCalledWith({ context: DailySignupSummaryHandler.name });
  });

  it("seeds the next run at the configured hour under that day's key", async () => {
    const { handler, jobQueueService } = setup({ hourUtc: 7 });

    await handler.seedNextRun(new Date("2026-11-10T08:00:00.000Z"));

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PostDailySignupSummary({ windowEndsAt: "2026-11-11T07:00:00.000Z" }), {
      singletonKey: "dailySignupSummary.2026-11-11",
      startAfter: "2026-11-11T07:00:00.000Z"
    });
  });

  it("logs a seed that could not be enqueued instead of failing", async () => {
    const { handler, jobQueueService, logger } = setup();
    const error = new Error("queue unavailable");
    jobQueueService.enqueue.mockRejectedValue(error);

    await handler.seedNextRun(new Date(WINDOW_ENDS_AT));

    expect(logger.error).toHaveBeenCalledWith({ event: "DAILY_SIGNUP_SUMMARY_SCHEDULE_FAILED", error });
  });

  it("posts the previous day's summary and queues the next one", async () => {
    const { handler, jobQueueService, userRepository, userWalletRepository, slackWebhookClient, logger, accounts } = setup();

    await handler.handle({ windowEndsAt: WINDOW_ENDS_AT, version: 1 });

    const window = [new Date(WINDOW_STARTS_AT), new Date(WINDOW_ENDS_AT)];
    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PostDailySignupSummary({ windowEndsAt: NEXT_WINDOW_ENDS_AT }), {
      singletonKey: "dailySignupSummary.2026-11-11",
      startAfter: NEXT_WINDOW_ENDS_AT
    });
    expect(jobQueueService.findRecentlyFinishedSingletonKeys).toHaveBeenCalledWith({ name: "PostDailySignupSummary", since: new Date(WINDOW_STARTS_AT) });
    expect(userRepository.findCreatedBetween).toHaveBeenCalledWith(...window);
    expect(userWalletRepository.countTrialsStartedBetween).toHaveBeenCalledWith(...window);
    expect(slackWebhookClient.post).toHaveBeenCalledWith(
      WEBHOOK_URL,
      buildDailySignupSummaryMessage(
        {
          windowStartsAt: new Date(WINDOW_STARTS_AT),
          windowEndsAt: new Date(WINDOW_ENDS_AT),
          accounts,
          trialsStarted: 2
        },
        ADMIN_URL
      )
    );
    expect(logger.info).toHaveBeenCalledWith({ event: "DAILY_SIGNUP_SUMMARY_POSTED", windowEndsAt: WINDOW_ENDS_AT, accounts: 1 });
  });

  it("queues the next run after the present when a run starts late, skipping the days it missed", async () => {
    const { handler, jobQueueService } = setup({ now: new Date("2026-11-12T20:00:00.000Z") });

    await handler.handle({ windowEndsAt: WINDOW_ENDS_AT, version: 1 });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(new PostDailySignupSummary({ windowEndsAt: "2026-11-13T13:00:00.000Z" }), {
      singletonKey: "dailySignupSummary.2026-11-13",
      startAfter: "2026-11-13T13:00:00.000Z"
    });
  });

  it("queues the next day even when the worker's clock still reads just before the scheduled hour", async () => {
    const { handler, jobQueueService } = setup({ now: new Date("2026-11-10T12:59:58.000Z") });

    await handler.handle({ windowEndsAt: WINDOW_ENDS_AT, version: 1 });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(PostDailySignupSummary), expect.objectContaining({ startAfter: NEXT_WINDOW_ENDS_AT }));
  });

  it("queues the next run without reading or posting anything while no review channel is configured", async () => {
    const { handler, jobQueueService, userRepository, slackWebhookClient } = setup({ webhookUrl: undefined });

    await handler.handle({ windowEndsAt: WINDOW_ENDS_AT, version: 1 });

    expect(jobQueueService.enqueue).toHaveBeenCalledWith(expect.any(PostDailySignupSummary), expect.objectContaining({ startAfter: NEXT_WINDOW_ENDS_AT }));
    expect(userRepository.findCreatedBetween).not.toHaveBeenCalled();
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
  });

  it("does not post a day whose summary already finished", async () => {
    const { handler, userRepository, slackWebhookClient } = setup({ finishedKeys: ["dailySignupSummary.2026-11-10"] });

    await handler.handle({ windowEndsAt: WINDOW_ENDS_AT, version: 1 });

    expect(userRepository.findCreatedBetween).not.toHaveBeenCalled();
    expect(slackWebhookClient.post).not.toHaveBeenCalled();
  });

  it("logs a rejected post and lets it fail the job so the queue retries it", async () => {
    const { handler, slackWebhookClient, logger } = setup();
    const error = new Error("Slack webhook answered 500");
    slackWebhookClient.post.mockRejectedValue(error);

    await expect(handler.handle({ windowEndsAt: WINDOW_ENDS_AT, version: 1 })).rejects.toThrow(error);

    expect(logger.error).toHaveBeenCalledWith({ event: "DAILY_SIGNUP_SUMMARY_POST_FAILED", windowEndsAt: WINDOW_ENDS_AT, error });
    expect(logger.info).not.toHaveBeenCalled();
  });

  function setup(input: { webhookUrl?: string; hourUtc?: number; finishedKeys?: string[]; now?: Date } = {}) {
    vi.useFakeTimers({ now: input.now ?? new Date("2026-11-10T13:00:05.000Z"), toFake: ["Date"] });
    const accounts: CreatedAccount[] = [{ id: "account-1", email: "new@example.com", userId: "auth0|1", lastFingerprint: null }];
    const jobQueueService = mock<JobQueueService>({
      enqueue: vi.fn().mockResolvedValue("job-id"),
      findRecentlyFinishedSingletonKeys: vi.fn().mockResolvedValue(new Set(input.finishedKeys ?? ["dailySignupSummary.2026-11-09"]))
    });
    const userRepository = mock<UserRepository>({ findCreatedBetween: vi.fn().mockResolvedValue(accounts) });
    const userWalletRepository = mock<UserWalletRepository>({ countTrialsStartedBetween: vi.fn().mockResolvedValue(2) });
    const workloadAbuseConfig = mockConfig<WorkloadAbuseConfigService>({
      WORKLOAD_ABUSE_SIGNUP_REVIEW_SLACK_WEBHOOK_URL: "webhookUrl" in input ? input.webhookUrl : WEBHOOK_URL,
      WORKLOAD_ABUSE_DAILY_SUMMARY_HOUR_UTC: input.hourUtc ?? 13
    });
    const billingConfig = mockConfig<BillingConfigService>({ CONSOLE_ADMIN_URL: ADMIN_URL });
    const slackWebhookClient = mock<HttpClient>();
    const logger = mock<ReturnType<CreateLogger>>();
    const createLogger = vi.fn<CreateLogger>(() => logger);
    const handler = new DailySignupSummaryHandler(
      jobQueueService,
      userRepository,
      userWalletRepository,
      workloadAbuseConfig,
      billingConfig,
      slackWebhookClient,
      createLogger
    );

    return { handler, accounts, jobQueueService, userRepository, userWalletRepository, slackWebhookClient, logger, createLogger };
  }
});
