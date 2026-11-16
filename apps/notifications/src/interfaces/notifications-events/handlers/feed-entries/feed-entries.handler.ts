import { Injectable } from "@nestjs/common";

import { eventKeyRegistry } from "@src/common/config/event-key-registry.config";
import { Handler } from "@src/infrastructure/broker";
import { FeedEntriesCommandDto } from "@src/modules/notifications/dto/FeedEntriesCommand.dto";
import { ActivityFeedService, toAlertActivity } from "@src/modules/notifications/services/activity-feed/activity-feed.service";

@Injectable()
export class FeedEntriesHandler {
  constructor(private readonly activityFeedService: ActivityFeedService) {}

  @Handler({
    key: eventKeyRegistry.addFeedEntries,
    dto: FeedEntriesCommandDto
  })
  async add({ feedEntries }: FeedEntriesCommandDto): Promise<void> {
    for (const entry of feedEntries) {
      await this.activityFeedService.addToFeed(toAlertActivity(entry, entry.summary));
    }
  }
}
