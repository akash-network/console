import { faker } from "@faker-js/faker";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { describe, expect, it, onTestFinished, vi } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { ActivityFeedClient, type AlertActivity } from "../activity-feed-client/activity-feed-client.service";
import { ActivityFeedService } from "./activity-feed.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(ActivityFeedService.name, () => {
  it("adds the alert to the user's feed", async () => {
    const { service, activityFeedClient, loggerService } = await setup({ isConfigured: true });
    const activity = createAlertActivity();
    activityFeedClient.addAlert.mockResolvedValue(undefined);

    await service.addToFeed(activity);

    expect(activityFeedClient.addAlert).toHaveBeenCalledWith(activity);
    expect(loggerService.setContext).toHaveBeenCalledWith(ActivityFeedService.name);
    expect(loggerService.warn).not.toHaveBeenCalled();
  });

  it.each([
    ["console-api refuses the alert", new Error('console-api answered 503: {"message":"Service Unavailable"}')],
    ["console-api does not answer in time", new DOMException("The operation was aborted due to timeout", "TimeoutError")],
    ["console-api cannot be reached", new TypeError("fetch failed")]
  ])("logs the failed write instead of failing the caller when %s", async (_, error) => {
    const { service, activityFeedClient, loggerService } = await setup({ isConfigured: true });
    const activity = createAlertActivity();
    activityFeedClient.addAlert.mockRejectedValue(error);

    await expect(service.addToFeed(activity)).resolves.toBeUndefined();

    expect(loggerService.warn).toHaveBeenCalledWith({
      event: "ACTIVITY_FEED_WRITE_FAILED",
      userId: activity.userId,
      type: "wallet_balance_alert",
      dedupeKey: activity.dedupeKey,
      error
    });
  });

  it("warns once that the feed is off when console-api is not configured, then skips every alert quietly", async () => {
    const { service, activityFeedClient, loggerService } = await setup({ isConfigured: false });

    await service.addToFeed(createAlertActivity());
    await service.addToFeed(createAlertActivity());
    await service.addToFeed(createAlertActivity());

    expect(activityFeedClient.addAlert).not.toHaveBeenCalled();
    expect(loggerService.warn).toHaveBeenCalledTimes(1);
    expect(loggerService.warn).toHaveBeenCalledWith({
      event: "ACTIVITY_FEED_DISABLED",
      reason: "CONSOLE_API_BASE_URL and CONSOLE_API_INTERNAL_TOKEN are not both set"
    });
  });

  it("starts with the real client and calls nothing while the console-api settings are missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    onTestFinished(() => {
      fetchSpy.mockRestore();
    });
    const loggerService = new LoggerService();
    const warn = vi.spyOn(loggerService, "warn").mockImplementation(() => undefined);
    const module = await Test.createTestingModule({
      providers: [
        ActivityFeedService,
        ActivityFeedClient,
        { provide: ConfigService, useValue: new ConfigService({ notifications: { CONSOLE_API_TIMEOUT_MS: 2000 } }) },
        { provide: LoggerService, useValue: loggerService }
      ]
    }).compile();
    const service = module.get(ActivityFeedService);

    await expect(service.addToFeed(createAlertActivity())).resolves.toBeUndefined();
    await expect(service.addToFeed(createAlertActivity())).resolves.toBeUndefined();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: "ACTIVITY_FEED_DISABLED" }));
  });

  function createAlertActivity(): AlertActivity {
    const alertId = faker.string.uuid();

    return {
      userId: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      projectId: null,
      type: "wallet_balance_alert",
      dedupeKey: `wallet_balance_alert.${alertId}.${faker.number.int({ min: 1_000_000, max: 9_000_000 })}`,
      meta: { alertId, summary: "Wallet balance is below 10 USD" }
    };
  }

  async function setup(input: { isConfigured: boolean }) {
    const module = await Test.createTestingModule({
      providers: [ActivityFeedService, MockProvider(ActivityFeedClient, { isConfigured: input.isConfigured }), MockProvider(LoggerService)]
    }).compile();

    return {
      service: module.get(ActivityFeedService),
      activityFeedClient: module.get<MockProxy<ActivityFeedClient>>(ActivityFeedClient),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService)
    };
  }
});
