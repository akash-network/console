import { subject } from "@casl/ability";
import { singleton } from "tsyringe";

import { decodeActivityCursor, encodeActivityCursor } from "@src/activity/lib/activity-cursor/activity-cursor";
import { AuthService } from "@src/auth/services/auth.service";
import type { UnscopedReason } from "@src/core/repositories/unscoped-reasons";
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
  async recordForDeployment<T extends "deployment_created" | "deployment_closed" | "deployment_updated" | "deployment_renamed">(
    activity: OrganizationActivityRecord<T>
  ): Promise<void> {
    await this.organizationActivityRepository.unscoped("deployment-activity").create(activity);
  }

  /** Filed into the new team, which the request creating it does not run in yet. */
  async recordTeamCreated(activity: OrganizationActivityRecord<"organization_created">): Promise<void> {
    await this.organizationActivityRepository.unscoped("organization-creation").create(activity);
  }

  /** Filed into the team that invited them, which the invitee's request does not run in. */
  async recordInvitationAnswer<T extends "member_joined" | "invitation_declined">(
    activity: OrganizationActivityRecord<T>,
    reason: Extract<UnscopedReason, "invitation-by-token" | "invitation-by-verified-email">
  ): Promise<void> {
    await this.organizationActivityRepository.unscoped(reason).create(activity);
  }

  async list({ limit, cursor, projectId }: { limit: number; cursor?: string; projectId?: string }): Promise<OrganizationActivityPage> {
    const after = cursor ? decodeActivityCursor(cursor) : undefined;
    const rows = await this.organizationActivityRepository.accessibleBy(this.authService.ability, "read").findPage({ limit: limit + 1, after, projectId });
    const activities = rows.slice(0, limit);
    const hasMore = rows.length > limit;

    return {
      activities: activities.map(activity => this.#hideInviteeEmailUnlessInvitationsReadable(activity)),
      nextCursor: hasMore ? encodeActivityCursor(toPosition(activities[activities.length - 1])) : null
    };
  }

  /** An invitee's address stays as private as the invitation that holds it. */
  #hideInviteeEmailUnlessInvitationsReadable(activity: OrganizationActivityWithActor): OrganizationActivityWithActor {
    if (activity.type !== "member_invited" || this.#canReadInvitationsOf(activity.organizationId)) {
      return activity;
    }

    const { email: _email, ...payload } = activity.payload;

    return { ...activity, payload };
  }

  #canReadInvitationsOf(organizationId: string): boolean {
    return this.authService.ability.can("read", subject("OrganizationInvitation", { organizationId }));
  }
}

function toPosition({ createdAt, id }: OrganizationActivityWithActor) {
  return { createdAt: createdAt.toISOString(), id };
}
