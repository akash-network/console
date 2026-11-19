import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { notifyEach } from "@src/billing/lib/notify-each/notify-each";
import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { type CreateNotificationInput, NotificationService } from "@src/notifications/services/notification/notification.service";
import { templatePublisherNotification } from "@src/notifications/services/notification-templates/template-publisher-notification";
import type { OrganizationRole } from "@src/organization/model-schemas/organization-member/organization-member.schema";
import {
  OrganizationMemberRepository,
  type OrganizationMemberWithUser
} from "@src/organization/repositories/organization-member/organization-member.repository";
import {
  failedCheckMessagesOf,
  holdReasonMessagesOf,
  type PublisherNoticeKind,
  publisherNoticeKindOf
} from "@src/template-marketplace/lib/publisher-notice/publisher-notice";
import { MarketplaceTemplateRepository } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import { TemplateModerationEventRepository } from "@src/template-marketplace/repositories/template-moderation-event/template-moderation-event.repository";
import { TemplatePublisherRepository } from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import { type TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { NotifyTemplatePublishers, type TemplatePublisherNoticeSource } from "./notify-template-publishers.job";

type NoticeTemplate = { id: string; title: string; organizationId: string; currentVersionId: string | null };

type PublisherNotice = {
  kind: PublisherNoticeKind;
  dedupeId: string;
  organizationId: string;
  template: NoticeTemplate | undefined;
  version: TemplateVersionOutput | undefined;
  reason: string | null;
  exceptUserId?: string;
};

type Addressed = { recipient: OrganizationMemberWithUser; notification: CreateNotificationInput };

const PUBLISHER_CONTACT_ROLES: OrganizationRole[] = ["owner", "admin"];

const UNNAMED_PUBLISHER = "your organization";

function issuesToldBy({ kind, version }: PublisherNotice): string[] {
  if (kind === "version_failed_checks") return failedCheckMessagesOf(version?.checkResults ?? null);
  if (kind === "version_held") return holdReasonMessagesOf(version?.holdReasons ?? null);

  return [];
}

/** Sends through the transactional path, so a member who unsubscribed from product updates still hears what happened to their organization's templates. */
@singleton()
export class NotifyTemplatePublishersHandler implements JobHandler<NotifyTemplatePublishers> {
  public readonly accepts = NotifyTemplatePublishers;

  /** With the singletonKey of each notice, keeps one queued twice from emailing the publisher twice. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly templateModerationEventRepository: TemplateModerationEventRepository,
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly templatePublisherRepository: TemplatePublisherRepository,
    private readonly organizationMemberRepository: OrganizationMemberRepository,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: NotifyTemplatePublishersHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** The in-app entries are written first and deduplicated per member, so a retry after a failed email repeats none of them. */
  async handle(source: JobPayload<NotifyTemplatePublishers>): Promise<void> {
    const notice = await this.#resolve(source);

    if (!notice) {
      this.logger.info({ event: "TEMPLATE_PUBLISHER_NOTICE_SKIPPED", reason: "SUBJECT_NOT_FOUND", source });
      return;
    }

    const addressed = await this.#address(notice);

    for (const { recipient, notification } of addressed) {
      await this.activityService.record({
        userId: recipient.userId,
        organizationId: notice.organizationId,
        type: "template_update",
        status: "info",
        initiator: "system",
        meta: { summary: notification.payload.summary, ...(notice.template && { templateId: notice.template.id }) },
        dedupeKey: `templateNotice:${notice.kind}:${notice.dedupeId}`
      });
    }

    await notifyEach(
      addressed.filter(({ recipient }) => !!recipient.email),
      ({ notification }) => this.notificationService.createNotificationOnce(notification),
      ({ recipient }, error) =>
        this.logger.error({ event: "TEMPLATE_PUBLISHER_NOTICE_EMAIL_FAILED", kind: notice.kind, recipientUserId: recipient.userId, error })
    );

    this.logger.info({ event: "TEMPLATE_PUBLISHER_NOTICE_SENT", kind: notice.kind, organizationId: notice.organizationId, recipientCount: addressed.length });
  }

  async #resolve(source: TemplatePublisherNoticeSource): Promise<PublisherNotice | undefined> {
    return source.source === "moderation" ? await this.#resolveModeration(source.eventId) : await this.#resolveVersionOutcome(source);
  }

  /** An event that names no version is told to whoever saved the template's current one. */
  async #resolveModeration(eventId: string): Promise<PublisherNotice | undefined> {
    const event = await this.templateModerationEventRepository.findById(eventId);
    const kind = event && publisherNoticeKindOf(event.action);

    if (!event || !kind) return undefined;

    const about = { kind, dedupeId: event.id, reason: event.reason };

    if (!event.templateId) {
      return event.organizationId ? { ...about, organizationId: event.organizationId, template: undefined, version: undefined } : undefined;
    }

    const template = await this.marketplaceTemplateRepository.findOfAnyOrganization(event.templateId);
    const versionId = event.templateVersionId ?? template?.currentVersionId;

    return template && { ...about, organizationId: template.organizationId, template, version: versionId ? await this.#findVersion(versionId) : undefined };
  }

  async #resolveVersionOutcome(source: Exclude<TemplatePublisherNoticeSource, { source: "moderation" }>): Promise<PublisherNotice | undefined> {
    const version = await this.#findVersion(source.versionId);
    const template = version && (await this.marketplaceTemplateRepository.findOfAnyOrganization(version.templateId));

    return (
      template && {
        kind: source.source,
        dedupeId: version.id,
        organizationId: template.organizationId,
        template,
        version,
        reason: null,
        exceptUserId: "savedByUserId" in source ? source.savedByUserId : undefined
      }
    );
  }

  async #findVersion(id: string): Promise<TemplateVersionOutput | undefined> {
    return await this.templateVersionRepository.findById(id);
  }

  /** Goes to the organization's owners and admins and to whoever saved the version, while they are still members. */
  async #address(notice: PublisherNotice): Promise<Addressed[]> {
    const members = await this.organizationMemberRepository.unscoped("template-publisher-notifications").findAllWithUsers(notice.organizationId);
    const publisher = await this.templatePublisherRepository.findPublishingOrganization(notice.organizationId);
    const vars = {
      kind: notice.kind,
      dedupeId: notice.dedupeId,
      publisherName: publisher?.name ?? UNNAMED_PUBLISHER,
      templateTitle: notice.template?.title ?? null,
      versionNumber: notice.version?.version ?? null,
      reason: notice.reason,
      issues: issuesToldBy(notice),
      templateUrl: notice.template && `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/template/${notice.template.id}`
    };

    return members
      .filter(member => member.userId !== notice.exceptUserId)
      .filter(member => PUBLISHER_CONTACT_ROLES.includes(member.role) || member.userId === notice.version?.createdById)
      .map(recipient => ({ recipient, notification: templatePublisherNotification({ id: recipient.userId, email: recipient.email }, vars) }));
  }
}
