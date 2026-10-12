import { faker } from "@faker-js/faker";
import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";
import type { MockProxy } from "vitest-mock-extended";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { ActivityFeedClient, type AlertActivity } from "../activity-feed-client/activity-feed-client.service";
import { ActivityFeedService } from "./activity-feed.service";

import { MockProvider } from "@test/mocks/provider.mock";

describe(ActivityFeedService.name, () => {
  it("adds the alert to the user's feed", async () => {
    const { service, activityFeedClient, loggerService } = await setup();
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
    ["console-api cannot be reached", new TypeError("fetch failed")],
    ["console-api is not configured", new Error("CONSOLE_API_BASE_URL and CONSOLE_API_INTERNAL_TOKEN must both be set to write to the activity feed")]
  ])("logs the failed write instead of failing the caller when %s", async (_, error) => {
    const { service, activityFeedClient, loggerService } = await setup();
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

  function createAlertActivity(): AlertActivity {
    const alertId = faker.string.uuid();

    return {
      userId: faker.string.uuid(),
      type: "wallet_balance_alert",
      dedupeKey: `wallet_balance_alert.${alertId}.${faker.number.int({ min: 1_000_000, max: 9_000_000 })}`,
      meta: { alertId, summary: "Wallet balance is below 10 USD" }
    };
  }

  async function setup() {
    const module = await Test.createTestingModule({
      providers: [ActivityFeedService, MockProvider(ActivityFeedClient), MockProvider(LoggerService)]
    }).compile();

    return {
      service: module.get(ActivityFeedService),
      activityFeedClient: module.get<MockProxy<ActivityFeedClient>>(ActivityFeedClient),
      loggerService: module.get<MockProxy<LoggerService>>(LoggerService)
    };
  }
});
