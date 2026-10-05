import { singleton } from "tsyringe";

import type {
  ActivityResponse,
  ListActivitiesQuery,
  ListActivitiesResponse,
  MarkActivitiesSeenRequest,
  MarkActivitiesSeenResponse
} from "@src/activity/http-schemas/activity.schema";
import type { ActivityOutput } from "@src/activity/repositories/activity/activity.repository";
import { ActivityService } from "@src/activity/services/activity/activity.service";
import { Protected } from "@src/auth/services/auth.service";

@singleton()
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Protected([{ action: "read", subject: "Activity" }])
  async list(query: ListActivitiesQuery): Promise<ListActivitiesResponse> {
    const [{ activities, hasMore, nextCursor }, unseenCount] = await Promise.all([this.activityService.list(query), this.activityService.countUnseen()]);

    return {
      data: {
        activities: activities.map(toActivityResponse),
        unseenCount,
        pagination: { limit: query.limit, hasMore, nextCursor }
      }
    };
  }

  @Protected([{ action: "update", subject: "Activity" }])
  async markSeen(selection: MarkActivitiesSeenRequest["data"]): Promise<MarkActivitiesSeenResponse> {
    return { data: { unseenCount: await this.activityService.markSeen(selection) } };
  }
}

function toActivityResponse({ id, type, status, meta, seenAt, createdAt, updatedAt }: ActivityOutput): ActivityResponse {
  return { id, type, status, meta, seenAt, createdAt, updatedAt };
}
