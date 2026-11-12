import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { describeReceiptForTenant } from "@src/hardware-request/lib/hardware-request-status-message/hardware-request-status-message";
import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { gpuRequestReceivedNotification } from "@src/notifications/services/notification-templates/gpu-request-received-notification";
import { UserRepository } from "@src/user/repositories";

export class HardwareRequestReceivedNoticeJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestReceivedNoticeJob";
  readonly name = HardwareRequestReceivedNoticeJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string }) {}
}

@singleton()
export class HardwareRequestReceivedNoticeHandler implements JobHandler<HardwareRequestReceivedNoticeJob> {
  public readonly accepts = HardwareRequestReceivedNoticeJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestReceivedNoticeHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId }: JobPayload<HardwareRequestReceivedNoticeJob>): Promise<void> {
    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);
    const requester = hardwareRequest?.userId ? await this.userRepository.findById(hardwareRequest.userId) : undefined;

    if (!hardwareRequest || (hardwareRequest.userId && !requester)) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_RECEIVED_NOTICE_SKIPPED", hardwareRequestId, reason: "Request or requester not found" });
      return;
    }

    const recipient = requester ?? { id: emailRecipientUserId(hardwareRequest.contactEmail), email: hardwareRequest.contactEmail };

    if (!recipient.email) return;

    const { headline, detail } = describeReceiptForTenant(hardwareRequestTitle(hardwareRequest));

    await this.notificationService.createNotification(
      gpuRequestReceivedNotification(recipient, {
        hardwareRequestId,
        headline,
        detail,
        requestUrl: `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/gpu-requests/${encodeURIComponent(hardwareRequestId)}`
      })
    );
  }
}
