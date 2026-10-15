import { createHash } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import {
  OrganizationMemberRepository,
  type OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";

export class StopTeamAlertsToDepartedMember implements Job {
  static readonly [JOB_NAME] = "StopTeamAlertsToDepartedMember";
  readonly name = StopTeamAlertsToDepartedMember[JOB_NAME];
  readonly version = 1;

  /** Carries a digest of the member's address instead of the address, so the queue keeps no email of a deleted account. */
  constructor(public readonly data: { organizationId: string; userId: string; addressSha256: string }) {}
}

/** Outlasts a notifications outage of a few hours, and an api release that reaches production before the notifications endpoint it calls. */
export const STOP_TEAM_ALERTS_TO_DEPARTED_MEMBER_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 60 * 60
} satisfies EnqueueOptions;

export function addressSha256Of(address: string): string {
  return createHash("sha256").update(address.toLowerCase()).digest("hex");
}

/** The owners with an email, or every member with one when no owner has an email, so an emptied channel still reaches the team. */
function fallbackAddressesOf(members: OrganizationMemberWithUser[]): string[] {
  const reachableMembers = members.filter((member): member is OrganizationMemberWithUser & { email: string } => !!member.email);
  const reachableOwners = reachableMembers.filter(({ role }) => role === "owner");

  return (reachableOwners.length ? reachableOwners : reachableMembers).map(({ email }) => email);
}

@singleton()
export class StopTeamAlertsToDepartedMemberHandler implements JobHandler<StopTeamAlertsToDepartedMember> {
  public readonly accepts = StopTeamAlertsToDepartedMember;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly notificationService: NotificationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: StopTeamAlertsToDepartedMemberHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Reads the members when it runs, so an address that is a member's again stays and an emptied channel goes to the team's owners by then. */
  async handle({ organizationId, userId, addressSha256 }: JobPayload<StopTeamAlertsToDepartedMember>): Promise<void> {
    const members = await this.organizationMemberRepository.findAllWithUsers(organizationId);
    const addressBelongsToCurrentMember = members.some(({ email }) => !!email && addressSha256Of(email) === addressSha256);

    if (addressBelongsToCurrentMember) {
      this.#logger.info({ event: "DEPARTED_MEMBER_ADDRESS_KEPT_FOR_CURRENT_MEMBER", organizationId, userId });
      return;
    }

    await this.notificationService.releaseDepartedMemberAddress({ organizationId, addressSha256, fallbackAddresses: fallbackAddressesOf(members) });

    this.#logger.info({ event: "TEAM_ALERTS_STOPPED_FOR_DEPARTED_MEMBER", organizationId, userId });
  }
}
