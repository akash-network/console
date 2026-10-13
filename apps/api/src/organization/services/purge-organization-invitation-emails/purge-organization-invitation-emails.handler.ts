import { addHours, subHours } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { OrganizationInvitationEmailRepository } from "@src/organization/repositories/organization-invitation-email/organization-invitation-email.repository";
import { INVITATION_EMAIL_RETENTION_HOURS } from "@src/organization/services/invitation-email-limiter/invitation-email-limiter.service";
import { PurgeOrganizationInvitationEmailsJob, purgeOrganizationInvitationEmailsOptionsFor } from "./purge-organization-invitation-emails.job";

@singleton()
export class PurgeOrganizationInvitationEmailsHandler implements JobHandler<PurgeOrganizationInvitationEmailsJob> {
  public readonly accepts = PurgeOrganizationInvitationEmailsJob;

  /** One waiting purge per organization, so sends recorded while it waits queue no other. */
  public readonly policy = "short";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly emailRepository: OrganizationInvitationEmailRepository,
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: PurgeOrganizationInvitationEmailsHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Queues the next purge for the oldest send it keeps, since sends recorded while this one waited queued none. */
  async handle({ organizationId }: JobPayload<PurgeOrganizationInvitationEmailsJob>): Promise<void> {
    const emailRepository = this.emailRepository.unscoped("invitation-email-retention");
    const purgedCount = await emailRepository.deleteSentBefore(organizationId, subHours(new Date(), INVITATION_EMAIL_RETENTION_HOURS));
    this.#logger.info({ event: "ORGANIZATION_INVITATION_EMAILS_PURGED", organizationId, purgedCount });

    const oldestKeptSentAt = await emailRepository.findOldestSentAt(organizationId);
    if (!oldestKeptSentAt) return;

    await this.jobQueueService.enqueue(
      new PurgeOrganizationInvitationEmailsJob({ organizationId }),
      purgeOrganizationInvitationEmailsOptionsFor(organizationId, addHours(oldestKeptSentAt, INVITATION_EMAIL_RETENTION_HOURS))
    );
  }
}
