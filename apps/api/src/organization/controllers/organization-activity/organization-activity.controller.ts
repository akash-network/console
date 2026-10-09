import { singleton } from "tsyringe";

import { Protected } from "@src/auth/services/auth.service";
import type {
  ListOrganizationActivitiesQuery,
  ListOrganizationActivitiesResponse,
  OrganizationActivityResponseItem
} from "@src/organization/http-schemas/organization-activity.schema";
import type { OrganizationActivityWithActor } from "@src/organization/repositories/organization-activity/organization-activity.repository";
import { OrganizationActivityService } from "@src/organization/services/organization-activity/organization-activity.service";

@singleton()
export class OrganizationActivityController {
  constructor(private readonly organizationActivityService: OrganizationActivityService) {}

  @Protected()
  async list(query: ListOrganizationActivitiesQuery): Promise<ListOrganizationActivitiesResponse> {
    const { activities, nextCursor } = await this.organizationActivityService.list(query);

    return { data: activities.map(toOrganizationActivityResponse), nextCursor };
  }
}

function toOrganizationActivityResponse({ id, projectId, actor, type, payload, createdAt }: OrganizationActivityWithActor): OrganizationActivityResponseItem {
  return { id, projectId, actor, type, payload, createdAt: createdAt.toISOString() };
}
