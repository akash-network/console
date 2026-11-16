import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { FeedEntriesCommandDto } from "@src/modules/notifications/dto/FeedEntriesCommand.dto";
import type { ActivityFeedService } from "@src/modules/notifications/services/activity-feed/activity-feed.service";
import { FeedEntriesHandler } from "./feed-entries.handler";

describe(FeedEntriesHandler.name, () => {
  describe("add", () => {
    it("files each entry in its user's feed under its own summary", async () => {
      const { handler, activityFeedService } = setup();
      const entries = [generateFeedEntry({ dseq: "1001", summary: "Deployment 1001 is now closed" }), generateFeedEntry({ summary: "Deployment 2002 is now closed" })];

      await handler.add({ feedEntries: entries });

      expect(activityFeedService.addToFeed.mock.calls.map(([activity]) => activity)).toEqual(
        entries.map(({ type, dedupeKey, alertId, dseq, userId, organizationId, projectId, summary }) => ({
          userId,
          organizationId,
          projectId,
          type,
          dedupeKey,
          meta: { alertId, summary, dseq }
        }))
      );
    });
  });

  function generateFeedEntry(overrides: Partial<FeedEntriesCommandDto["feedEntries"][number]>): FeedEntriesCommandDto["feedEntries"][number] {
    return {
      type: "deployment_closed_alert",
      alertId: faker.string.uuid(),
      userId: faker.string.uuid(),
      organizationId: faker.string.uuid(),
      projectId: null,
      dedupeKey: `deployment_close.${faker.string.alphanumeric(10)}.${faker.string.numeric(6)}`,
      summary: faker.lorem.sentence(),
      ...overrides
    };
  }

  function setup() {
    const activityFeedService = mock<ActivityFeedService>();

    return { handler: new FeedEntriesHandler(activityFeedService), activityFeedService };
  }
});
