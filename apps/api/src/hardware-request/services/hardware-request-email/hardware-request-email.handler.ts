import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { supportMailboxUserId } from "@src/hardware-request/lib/support-mailbox-user-id/support-mailbox-user-id";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { UserRepository } from "@src/user/repositories";
import { hardwareRequestEmailNotification } from "./hardware-request-email-notification";

export class HardwareRequestEmailJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestEmailJob";
  readonly name = HardwareRequestEmailJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string }) {}
}

@singleton()
export class HardwareRequestEmailHandler implements JobHandler<HardwareRequestEmailJob> {
  public readonly accepts = HardwareRequestEmailJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestEmailHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId }: JobPayload<HardwareRequestEmailJob>): Promise<void> {
    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);

    if (!hardwareRequest) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_EMAIL_SKIPPED", hardwareRequestId, reason: "Hardware request not found" });
      return;
    }

    const requester = await this.userRepository.findById(hardwareRequest.userId);
    const mailboxEmail = this.config.HARDWARE_REQUEST_EMAIL;

    await this.notificationService.createNotification(
      hardwareRequestEmailNotification({
        hardwareRequest,
        requester,
        mailbox: { id: supportMailboxUserId(mailboxEmail), email: mailboxEmail }
      })
    );
  }
}
