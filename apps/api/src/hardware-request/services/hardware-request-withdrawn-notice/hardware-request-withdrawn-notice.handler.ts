import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { hardwareRequestWithdrawnNotice } from "./hardware-request-withdrawn-notice";

export class HardwareRequestWithdrawnNoticeJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestWithdrawnNoticeJob";
  readonly name = HardwareRequestWithdrawnNoticeJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string; eventId: string }) {}
}

/** Tells whoever owns the request in sales, whatever its lane, and the shared mailbox when nobody does. */
@singleton()
export class HardwareRequestWithdrawnNoticeHandler implements JobHandler<HardwareRequestWithdrawnNoticeJob> {
  public readonly accepts = HardwareRequestWithdrawnNoticeJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestAlertContextService: HardwareRequestAlertContextService,
    private readonly notificationService: NotificationService,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestWithdrawnNoticeHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId, eventId }: JobPayload<HardwareRequestWithdrawnNoticeJob>): Promise<void> {
    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);

    if (!hardwareRequest) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_WITHDRAWN_NOTICE_SKIPPED", hardwareRequestId, reason: "Hardware request not found" });
      return;
    }

    const { owner } = await this.hardwareRequestAlertContextService.load(hardwareRequest);
    const email = owner?.email ?? this.config.HARDWARE_REQUEST_EMAIL;

    await this.notificationService.createNotification(
      hardwareRequestWithdrawnNotice({ hardwareRequest, eventId, recipient: { id: emailRecipientUserId(email), email } })
    );
  }
}
