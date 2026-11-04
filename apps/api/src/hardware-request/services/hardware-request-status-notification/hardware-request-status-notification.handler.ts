import { inject, singleton } from "tsyringe";

import { ActivityService } from "@src/activity/services/activity/activity.service";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { describeStatusForTenant } from "@src/hardware-request/lib/hardware-request-status-message/hardware-request-status-message";
import { hardwareRequestTitle } from "@src/hardware-request/lib/hardware-request-title/hardware-request-title";
import type { CloseReason, HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { gpuRequestStatusNotification } from "@src/notifications/services/notification-templates/gpu-request-status-notification";
import { UserRepository } from "@src/user/repositories";

export class HardwareRequestStatusNotificationJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestStatusNotificationJob";
  readonly name = HardwareRequestStatusNotificationJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string; eventId: string; status: HardwareRequestStatus; closeReason?: CloseReason }) {}
}

@singleton()
export class HardwareRequestStatusNotificationHandler implements JobHandler<HardwareRequestStatusNotificationJob> {
  public readonly accepts = HardwareRequestStatusNotificationJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly activityService: ActivityService,
    private readonly notificationService: NotificationService,
    private readonly deploymentConfigService: DeploymentConfigService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestStatusNotificationHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId, eventId, status, closeReason }: JobPayload<HardwareRequestStatusNotificationJob>): Promise<void> {
    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);
    const requester = hardwareRequest && (await this.userRepository.findById(hardwareRequest.userId));

    if (!hardwareRequest || !requester) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_STATUS_NOTIFICATION_SKIPPED", hardwareRequestId, reason: "Request or requester not found" });
      return;
    }

    const { headline, detail } = describeStatusForTenant(hardwareRequestTitle(hardwareRequest), status, closeReason);

    await this.activityService.record({
      userId: requester.id,
      organizationId: hardwareRequest.organizationId,
      type: "gpu_request_update",
      status: "info",
      initiator: "system",
      meta: { hardwareRequestId, hardwareRequestStatus: status, summary: headline },
      dedupeKey: `gpuRequestStatus:${eventId}`
    });

    if (!requester.email) return;

    await this.notificationService.createNotification(
      gpuRequestStatusNotification(requester, {
        eventId,
        headline,
        detail,
        requestUrl: `${this.deploymentConfigService.get("DEPLOY_WEB_BASE_URL")}/gpu-requests/${encodeURIComponent(hardwareRequestId)}`
      })
    );
  }
}
