import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import { type OrganizationOutput, OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  OrganizationMemberRepository,
  type OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import { adminAccessRequestEmailNotification } from "./admin-access-request-email-notification";

export const ROLES_THAT_MANAGE_MEMBERS: readonly OrganizationRole[] = ["owner", "admin"];

/** One owner's copy of a member's request to become an admin, so each owner's email is retried on its own. */
export class AdminAccessRequestEmailJob implements Job {
  static readonly [JOB_NAME] = "AdminAccessRequestEmailJob";
  readonly name = AdminAccessRequestEmailJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { organizationId: string; requesterUserId: string; ownerUserId: string; requestedAt: string }) {}
}

type EmailableRequest = { organization: OrganizationOutput; requester: OrganizationMemberWithUser; owner: OrganizationMemberWithUser };

@singleton()
export class AdminAccessRequestEmailHandler implements JobHandler<AdminAccessRequestEmailJob> {
  public readonly accepts = AdminAccessRequestEmailJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfig: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: AdminAccessRequestEmailHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ organizationId, requesterUserId, ownerUserId, requestedAt }: JobPayload<AdminAccessRequestEmailJob>): Promise<void> {
    const [organization, requester, owner] = await Promise.all([
      this.organizationRepository.findById(organizationId),
      this.organizationMemberRepository.findWithUserByUserId(organizationId, requesterUserId),
      this.organizationMemberRepository.findWithUserByUserId(organizationId, ownerUserId)
    ]);
    const request = toEmailableRequest({ organization, requester, owner });

    if (typeof request === "string") {
      this.#logger.info({ event: "ADMIN_ACCESS_REQUEST_EMAIL_SKIPPED", organizationId, requesterUserId, ownerUserId, reason: request });
      return;
    }

    await this.notificationService.createNotificationOnce(
      adminAccessRequestEmailNotification({
        ...request,
        membersUrl: `${this.deploymentConfig.get("DEPLOY_WEB_BASE_URL")}/members?org=${encodeURIComponent(organizationId)}`,
        requestedAt
      })
    );

    this.#logger.info({ event: "ADMIN_ACCESS_REQUEST_EMAIL_SENT", organizationId, requesterUserId, ownerUserId });
  }
}

/** The reason to send nothing, since the request may have gone stale while the job waited. */
function toEmailableRequest({ organization, requester, owner }: Partial<EmailableRequest>): EmailableRequest | string {
  if (!organization || organization.deletedAt) return "Organization deleted";
  if (!requester) return "Requester left the organization";
  if (ROLES_THAT_MANAGE_MEMBERS.includes(requester.role)) return "Requester already manages the organization";
  if (owner?.role !== "owner") return "Recipient is no longer an owner";
  if (!owner.email) return "Owner has no email";

  return { organization, requester, owner };
}
