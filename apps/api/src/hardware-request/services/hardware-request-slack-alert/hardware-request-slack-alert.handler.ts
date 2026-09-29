import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { UserRepository } from "@src/user/repositories";
import { buildHardwareRequestSlackMessage } from "./hardware-request-slack-message";

export class HardwareRequestSlackAlertJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestSlackAlertJob";
  readonly name = HardwareRequestSlackAlertJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string }) {}
}

@singleton()
export class HardwareRequestSlackAlertHandler implements JobHandler<HardwareRequestSlackAlertJob> {
  public readonly accepts = HardwareRequestSlackAlertJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly userRepository: UserRepository,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestSlackAlertHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId }: JobPayload<HardwareRequestSlackAlertJob>): Promise<void> {
    const webhookUrl = this.config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      this.#logger.debug({ event: "HARDWARE_REQUEST_SLACK_ALERT_SKIPPED", hardwareRequestId, reason: "Slack webhook URL not configured" });
      return;
    }

    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);

    if (!hardwareRequest) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_SLACK_ALERT_SKIPPED", hardwareRequestId, reason: "Hardware request not found" });
      return;
    }

    const requester = await this.userRepository.findById(hardwareRequest.userId);
    const message = buildHardwareRequestSlackMessage({
      hardwareRequest,
      requesterEmail: requester?.email,
      amplitudeProjectUrl: this.config.AMPLITUDE_PROJECT_URL,
      adminUrl: this.config.CONSOLE_ADMIN_URL
    });

    await this.slackWebhookClient.post(webhookUrl, message);
  }
}
