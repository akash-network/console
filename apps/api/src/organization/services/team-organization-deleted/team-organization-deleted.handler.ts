import { inject, singleton } from "tsyringe";

import { notifyEach } from "@src/billing/lib/notify-each/notify-each";
import { CustomerService } from "@src/billing/services/customer/customer.service";
import { type CreateLogger, type EnqueueOptions, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { teamOrganizationDeletedNotification } from "@src/notifications/services/notification-templates/team-organization-deleted-notification";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import { OrganizationMemberRepository } from "@src/organization/repositories/organization-member/organization-member.repository";

/** Finishes outside the Console database what deleting a team started, enqueued in the transaction that deletes it. */
export class TeamOrganizationDeleted implements Job {
  static readonly [JOB_NAME] = "TeamOrganizationDeleted";
  readonly name = TeamOrganizationDeleted[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { organizationId: string; deletedByUserId: string | null }) {}
}

export const TEAM_ORGANIZATION_DELETED_RETRY_OPTIONS = {
  retryLimit: 12,
  retryBackoff: true,
  retryDelay: 30,
  retryDelayMax: 60 * 60
} satisfies EnqueueOptions;

type CleanupStep = "stripe" | "notifications";

@singleton()
export class TeamOrganizationDeletedHandler implements JobHandler<TeamOrganizationDeleted> {
  public readonly accepts = TeamOrganizationDeleted;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly customerService: CustomerService,
    private readonly notificationService: NotificationService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: TeamOrganizationDeletedHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Emails go out only once the cards are gone, so a retry after a Stripe failure never emails a member twice. */
  async handle({ organizationId, deletedByUserId }: JobPayload<TeamOrganizationDeleted>): Promise<void> {
    const organization = await this.organizationRepository.findById(organizationId);

    if (!organization?.deletedAt) {
      this.#logger.warn({ event: "TEAM_ORGANIZATION_DELETION_CLEANUP_SKIPPED", organizationId, reason: "Organization is not deleted" });
      return;
    }

    const { stripeCustomerId } = organization;
    if (stripeCustomerId) await this.#runStep(organizationId, "stripe", () => this.customerService.detachPaymentMethods(stripeCustomerId));
    await this.#runStep(organizationId, "notifications", () => this.#notifyMembers(organization, deletedByUserId));

    this.#logger.info({ event: "TEAM_ORGANIZATION_DELETION_CLEANUP_COMPLETED", organizationId });
  }

  async #runStep(organizationId: string, step: CleanupStep, cleanUp: () => Promise<void>): Promise<void> {
    try {
      await cleanUp();
    } catch (error) {
      this.#logger.error({ event: "TEAM_ORGANIZATION_DELETION_CLEANUP_FAILED", organizationId, step, error });
      throw error;
    }
  }

  /** Billing contacts are members too, so every member with an email hears it once, the owner who deleted the team included. */
  async #notifyMembers(organization: OrganizationOutput, deletedByUserId: string | null): Promise<void> {
    const members = await this.organizationMemberRepository.unscoped("organization-deletion").findAllWithUsers(organization.id);
    const deletedByName = members.find(member => member.userId === deletedByUserId)?.username;

    await notifyEach(
      members.filter(member => !!member.email),
      member =>
        this.notificationService.createNotificationOnce(
          teamOrganizationDeletedNotification(
            { id: member.userId, email: member.email },
            { organizationId: organization.id, organizationName: organization.name, deletedByName }
          )
        ),
      (member, error) =>
        this.#logger.error({ event: "TEAM_ORGANIZATION_DELETED_EMAIL_FAILED", organizationId: organization.id, recipientUserId: member.userId, error })
    );
  }
}
