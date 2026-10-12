import { Injectable } from "@nestjs/common";

import { LoggerService } from "@src/common/services/logger/logger.service";
import { ActivityFeedClient, type AlertActivity } from "../activity-feed-client/activity-feed-client.service";

@Injectable()
export class ActivityFeedService {
  constructor(
    private readonly activityFeedClient: ActivityFeedClient,
    private readonly loggerService: LoggerService
  ) {
    this.loggerService.setContext(ActivityFeedService.name);
  }

  /** Best-effort, because an alert's email must go out whatever happens to its feed entry: a failed write is logged and never reaches the caller. */
  async addToFeed(activity: AlertActivity): Promise<void> {
    try {
      await this.activityFeedClient.addAlert(activity);
    } catch (error) {
      this.loggerService.warn({
        event: "ACTIVITY_FEED_WRITE_FAILED",
        userId: activity.userId,
        type: activity.type,
        dedupeKey: activity.dedupeKey,
        error
      });
    }
  }
}
