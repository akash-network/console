import { randomUUID } from "node:crypto";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY, TxService } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { createInvitationToken, hashInvitationToken, invitationUrl } from "@src/organization/lib/invitation-token/invitation-token";
import { OrganizationRepository } from "@src/organization/repositories/organization/organization.repository";
import {
  type OrganizationInvitationOutput,
  OrganizationInvitationRepository
} from "@src/organization/repositories/organization-invitation/organization-invitation.repository";
import { UserRepository } from "@src/user/repositories";
import { organizationInvitationEmailNotification } from "./organization-invitation-email-notification";

export class OrganizationInvitationEmailJob implements Job {
  static readonly [JOB_NAME] = "OrganizationInvitationEmailJob";
  readonly name = OrganizationInvitationEmailJob[JOB_NAME];
  readonly version = 1;

  /** `tokenHash` is the one the invitation carried when the email was requested; any token issued after it supersedes the email. */
  constructor(public readonly data: { invitationId: string; tokenHash: string }) {}
}

/** Issues the token it emails; the job data never carries a token. */
@singleton()
export class OrganizationInvitationEmailHandler implements JobHandler<OrganizationInvitationEmailJob> {
  public readonly accepts = OrganizationInvitationEmailJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly invitationRepository: OrganizationInvitationRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfig: DeploymentConfigService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: OrganizationInvitationEmailHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ invitationId, tokenHash }: JobPayload<OrganizationInvitationEmailJob>): Promise<void> {
    const invitation = await this.invitationRepository.findById(invitationId);
    const organization = invitation && (await this.organizationRepository.findById(invitation.organizationId));
    const skipReason = whyNotToEmail(invitation) ?? (organization?.deletedAt ? "Organization deleted" : undefined);

    if (!invitation || !organization || skipReason) {
      this.#logger.info({ event: "ORGANIZATION_INVITATION_EMAIL_SKIPPED", invitationId, reason: skipReason });
      return;
    }

    const inviter = invitation.invitedByUserId ? await this.userRepository.findById(invitation.invitedByUserId) : undefined;
    const token = createInvitationToken();

    await this.txService.transaction(async () => {
      const replaced = await this.invitationRepository.replaceTokenHash(invitationId, { from: tokenHash, to: hashInvitationToken(token) });

      if (!replaced) {
        this.#logger.info({ event: "ORGANIZATION_INVITATION_EMAIL_SKIPPED", invitationId, reason: "Invitation token was replaced" });
        return;
      }

      await this.notificationService.createNotification(
        organizationInvitationEmailNotification({
          invitation,
          organizationName: organization.name,
          inviterName: inviter?.username,
          invitationUrl: invitationUrl(this.deploymentConfig.get("DEPLOY_WEB_BASE_URL"), token),
          sendId: randomUUID()
        })
      );
    });
  }
}

function whyNotToEmail(invitation: OrganizationInvitationOutput | undefined): string | undefined {
  if (!invitation) return "Invitation not found";
  if (invitation.status !== "pending") return `Invitation is ${invitation.status}`;
  if (invitation.expiresAt <= new Date()) return "Invitation expired";

  return undefined;
}
