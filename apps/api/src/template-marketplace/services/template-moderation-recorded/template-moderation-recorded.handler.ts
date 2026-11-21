import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY, TxService } from "@src/core";
import { legacyMirrorOf } from "@src/template-marketplace/lib/legacy-mirror/legacy-version-mirror";
import { publisherNoticeKindOf } from "@src/template-marketplace/lib/publisher-notice/publisher-notice";
import { MarketplaceTemplateRepository } from "@src/template-marketplace/repositories/marketplace-template/marketplace-template.repository";
import {
  type TemplateModerationEventOutput,
  TemplateModerationEventRepository
} from "@src/template-marketplace/repositories/template-moderation-event/template-moderation-event.repository";
import { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import { type TemplateVersionOutput, TemplateVersionRepository } from "@src/template-marketplace/repositories/template-version/template-version.repository";
import { TemplatePublisherNotifierService } from "@src/template-marketplace/services/template-publisher-notifier/template-publisher-notifier.service";
import { TemplateModerationRecorded } from "./template-moderation-recorded.job";

type SkippedFollowUp =
  | "TEMPLATE_REMOVAL_FOUND_NOTHING_REMOVED"
  | "TEMPLATE_VERSION_APPROVAL_NOT_APPLIED"
  | "TEMPLATE_VERSION_APPROVAL_SUPERSEDED"
  | "TEMPLATE_VERSION_ROLLBACK_NOT_APPLIED";

type ReviewedVersion = { templateId: string; currentVersionId: string | null; version: TemplateVersionOutput };

/** Does what a staff action leaves to the Console: emptying a template staff marked removed, making an approved or rolled-back version the one people deploy, and telling the publisher. */
@singleton()
export class TemplateModerationRecordedHandler implements JobHandler<TemplateModerationRecorded> {
  public readonly accepts = TemplateModerationRecorded;

  /** With the per-event singletonKey admin-api sends, keeps an event queued twice from being handled twice at once. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly templateModerationEventRepository: TemplateModerationEventRepository,
    private readonly templateRemovalRepository: TemplateRemovalRepository,
    private readonly marketplaceTemplateRepository: MarketplaceTemplateRepository,
    private readonly templateVersionRepository: TemplateVersionRepository,
    private readonly templatePublisherNotifierService: TemplatePublisherNotifierService,
    private readonly txService: TxService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.logger = createLogger({ context: TemplateModerationRecordedHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ eventId }: JobPayload<TemplateModerationRecorded>): Promise<void> {
    const event = await this.templateModerationEventRepository.findById(eventId);

    if (!event) {
      this.logger.info({ event: "TEMPLATE_MODERATION_SKIPPED", reason: "EVENT_NOT_FOUND", eventId });
      return;
    }

    const skipped = await this.txService.transaction(async () => {
      const skippedFollowUp = await this.#followUp(event);

      if (!skippedFollowUp && publisherNoticeKindOf(event.action)) await this.templatePublisherNotifierService.notifyOfModeration(event.id);

      return skippedFollowUp;
    });

    if (skipped) this.logger.warn({ event: skipped, eventId, templateId: event.templateId });
    else this.logger.info({ event: "TEMPLATE_MODERATION_HANDLED", eventId, action: event.action });
  }

  /** A follow-up that finds the event describing something that did not happen changes nothing and tells the publisher nothing. */
  async #followUp(event: TemplateModerationEventOutput): Promise<SkippedFollowUp | undefined> {
    if (event.action === "remove") return (await this.#emptyRemovedTemplate(event)) ? undefined : "TEMPLATE_REMOVAL_FOUND_NOTHING_REMOVED";
    if (event.action === "approve_version") return await this.#promoteApprovedVersion(event);
    if (event.action === "rollback_version") return await this.#mirrorRolledBackVersion(event);

    return undefined;
  }

  async #emptyRemovedTemplate({ templateId }: TemplateModerationEventOutput): Promise<boolean> {
    return !!templateId && (await this.templateRemovalRepository.emptyRemoved(templateId, "staff"));
  }

  /** Staff only mark the version live; it becomes the one people deploy here, under the template lock a save takes, unless the publisher saved a newer one meanwhile. */
  async #promoteApprovedVersion(event: TemplateModerationEventOutput): Promise<SkippedFollowUp | undefined> {
    const reviewed = await this.#lockReviewedVersion(event);

    if (reviewed?.version.status !== "live") return "TEMPLATE_VERSION_APPROVAL_NOT_APPLIED";
    if (await this.templateVersionRepository.hasNewerLiveOrHeld(reviewed.templateId, reviewed.version.version)) return "TEMPLATE_VERSION_APPROVAL_SUPERSEDED";

    await this.templateVersionRepository.makeCurrent(reviewed.templateId, reviewed.version.id);
    await this.marketplaceTemplateRepository.mirrorVersion(reviewed.templateId, {
      ...legacyMirrorOf(reviewed.version),
      description: reviewed.version.readme ?? ""
    });

    return undefined;
  }

  /** Staff point the template at the earlier version; the legacy columns follow here, and a version without a readme keeps the description it always showed. */
  async #mirrorRolledBackVersion(event: TemplateModerationEventOutput): Promise<SkippedFollowUp | undefined> {
    const reviewed = await this.#lockReviewedVersion(event);

    if (!reviewed || reviewed.currentVersionId !== reviewed.version.id) return "TEMPLATE_VERSION_ROLLBACK_NOT_APPLIED";

    await this.marketplaceTemplateRepository.mirrorVersion(reviewed.templateId, {
      ...legacyMirrorOf(reviewed.version),
      ...(reviewed.version.readme !== null && { description: reviewed.version.readme })
    });

    return undefined;
  }

  async #lockReviewedVersion({ templateId, templateVersionId }: TemplateModerationEventOutput): Promise<ReviewedVersion | undefined> {
    if (!templateId || !templateVersionId) return undefined;

    const template = await this.marketplaceTemplateRepository.findAndLockForWrite(templateId);
    const version = await this.templateVersionRepository.findById(templateVersionId);

    if (!template || template.moderationStatus === "removed" || version?.templateId !== template.id) return undefined;

    return { templateId: template.id, currentVersionId: template.currentVersionId, version };
  }
}
