import { createHash } from "node:crypto";
import { singleton } from "tsyringe";

import { JobQueueService } from "@src/core";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";
import { UserRepository } from "@src/user/repositories/user/user.repository";
import { STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS, StopTeamAlertsToDepartedMember } from "./stop-team-alerts-to-departed-member.handler";

/** Queues taking a member's address off a team's alert channels, in the transaction that ends the membership, so a notifications outage cannot keep it there. */
@singleton()
export class DepartedMemberAlertsService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly jobQueueService: JobQueueService
  ) {}

  async stopTeamAlertsTo(userId: string, organizationId: string): Promise<void> {
    await this.#stopAlertsOfTeams(userId, [organizationId]);
  }

  /** Call it before deleting the user row, which cascades to the memberships it reads. */
  async stopEveryTeamAlertTo(userId: string): Promise<void> {
    const memberships = await this.organizationMemberRepository.findActiveMemberships(userId);
    const teamIds = memberships.filter(({ organization }) => organization.type === "team").map(({ organization }) => organization.id);

    await this.#stopAlertsOfTeams(userId, teamIds);
  }

  async #stopAlertsOfTeams(userId: string, organizationIds: string[]): Promise<void> {
    const user = await this.userRepository.findById(userId);

    if (!user?.email) return;

    const addressSha256 = createHash("sha256").update(user.email.toLowerCase()).digest("hex");

    for (const organizationId of organizationIds) {
      await this.jobQueueService.enqueue(
        new StopTeamAlertsToDepartedMember({ organizationId, userId, addressSha256 }),
        STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS
      );
    }
  }
}
