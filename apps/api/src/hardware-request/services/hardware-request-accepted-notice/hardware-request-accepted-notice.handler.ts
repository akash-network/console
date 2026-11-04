import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { UserRepository } from "@src/user/repositories";
import { hardwareRequestAcceptedNotice } from "./hardware-request-accepted-notice";

export class HardwareRequestAcceptedNoticeJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestAcceptedNoticeJob";
  readonly name = HardwareRequestAcceptedNoticeJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string; offerId: string; eventId: string; acceptedByUserId: string }) {}
}

/** Fulfillment is manual until v2, so the owner in sales, or the shared mailbox, sets the deployment up from this email. */
@singleton()
export class HardwareRequestAcceptedNoticeHandler implements JobHandler<HardwareRequestAcceptedNoticeJob> {
  public readonly accepts = HardwareRequestAcceptedNoticeJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    private readonly userRepository: UserRepository,
    private readonly hardwareRequestAlertContextService: HardwareRequestAlertContextService,
    private readonly notificationService: NotificationService,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestAcceptedNoticeHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId, offerId, eventId, acceptedByUserId }: JobPayload<HardwareRequestAcceptedNoticeJob>): Promise<void> {
    const [hardwareRequest, offer] = await Promise.all([
      this.hardwareRequestRepository.findById(hardwareRequestId),
      this.hardwareRequestOfferRepository.findById(offerId)
    ]);

    if (!hardwareRequest || !offer) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_ACCEPTED_NOTICE_SKIPPED", hardwareRequestId, offerId, reason: "Request or offer not found" });
      return;
    }

    const [{ owner }, acceptedBy] = await Promise.all([
      this.hardwareRequestAlertContextService.load(hardwareRequest),
      this.userRepository.findById(acceptedByUserId)
    ]);
    const email = owner?.email ?? this.config.HARDWARE_REQUEST_EMAIL;

    await this.notificationService.createNotification(
      hardwareRequestAcceptedNotice({
        hardwareRequest,
        offer,
        acceptedBy: acceptedBy?.email ?? undefined,
        eventId,
        recipient: { id: emailRecipientUserId(email), email }
      })
    );
  }
}
