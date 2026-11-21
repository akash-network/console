import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY, TxService } from "@src/core";
import { publisherNoticeKindOf } from "@src/template-marketplace/lib/publisher-notice/publisher-notice";
import {
  type TemplateModerationEventOutput,
  TemplateModerationEventRepository
} from "@src/template-marketplace/repositories/template-moderation-event/template-moderation-event.repository";
import { TemplateRemovalRepository } from "@src/template-marketplace/repositories/template-removal/template-removal.repository";
import { TemplatePublisherNotifierService } from "@src/template-marketplace/services/template-publisher-notifier/template-publisher-notifier.service";
import { TemplateModerationRecorded } from "./template-moderation-recorded.job";

/** Does what a staff action leaves to the Console: emptying a template staff marked removed, and telling its publisher. */
@singleton()
export class TemplateModerationRecordedHandler implements JobHandler<TemplateModerationRecorded> {
  public readonly accepts = TemplateModerationRecorded;

  /** With the per-event singletonKey admin-api sends, keeps an event queued twice from being handled twice at once. */
  public readonly policy = "exclusive";

  private readonly logger: ReturnType<CreateLogger>;

  constructor(
    private readonly templateModerationEventRepository: TemplateModerationEventRepository,
    private readonly templateRemovalRepository: TemplateRemovalRepository,
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

    const isApplied = await this.txService.transaction(async () => {
      if (event.action === "remove" && !(await this.#emptyRemovedTemplate(event))) return false;
      if (publisherNoticeKindOf(event.action)) await this.templatePublisherNotifierService.notifyOfModeration(event.id);

      return true;
    });

    if (isApplied) this.logger.info({ event: "TEMPLATE_MODERATION_HANDLED", eventId, action: event.action });
    else this.logger.warn({ event: "TEMPLATE_REMOVAL_FOUND_NOTHING_REMOVED", eventId, templateId: event.templateId });
  }

  /** A template nobody marked removed is left alone and its publisher told nothing, since the event then describes something that did not happen. */
  async #emptyRemovedTemplate({ templateId }: TemplateModerationEventOutput): Promise<boolean> {
    return !!templateId && (await this.templateRemovalRepository.emptyRemoved(templateId, "staff"));
  }
}
