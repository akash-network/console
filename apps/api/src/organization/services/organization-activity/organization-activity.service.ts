import { singleton } from "tsyringe";

import { decodeActivityCursor, encodeActivityCursor } from "@src/activity/lib/activity-cursor/activity-cursor";
import { AuthService } from "@src/auth/services/auth.service";
import type {
  OrganizationActivityPayloads,
  OrganizationActivityType
} from "@src/organization/model-schemas/organization-activity/organization-activity.schema";
import {
  OrganizationActivityRepository,
  type OrganizationActivityWithActor
} from "@src/organization/repositories/organization-activity/organization-activity.repository";

export type OrganizationActivityRecord<T extends OrganizationActivityType> = {
  organizationId: string;
  type: T;
  actorUserId: string | null;
  projectId?: string | null;
  payload: OrganizationActivityPayloads[T];
};

export interface OrganizationActivityPage {
  activities: OrganizationActivityWithActor[];
  nextCursor: string | null;
}

@singleton()
export class OrganizationActivityService {
  constructor(
    private readonly organizationActivityRepository: OrganizationActivityRepository,
    private readonly authService: AuthService
  ) {}

  async record<T extends OrganizationActivityType>(activity: OrganizationActivityRecord<T>): Promise<void> {
    await this.organizationActivityRepository.create(activity);
  }

  /** Filed into the deployment's own organization, which a job runs outside of and a request may not be active in. */
  async recordForDeployment<T extends "deployment_created" | "deployment_closed">(activity: OrganizationActivityRecord<T>): Promise<void> {
    await this.organizationActivityRepository.unscoped("deployment-activity").create(activity);
  }

  async list({ limit, cursor, projectId }: { limit: number; cursor?: string; projectId?: string }): Promise<OrganizationActivityPage> {
    const after = cursor ? decodeActivityCursor(cursor) : undefined;
    const rows = await this.organizationActivityRepository.accessibleBy(this.authService.ability, "read").findPage({ limit: limit + 1, after, projectId });
    const activities = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    return { activities, nextCursor: hasMore ? encodeActivityCursor(toPosition(activities[activities.length - 1])) : null };
  }
}

function toPosition({ createdAt, id }: OrganizationActivityWithActor) {
  return { createdAt: createdAt.toISOString(), id };
}
