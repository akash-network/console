import type { HttpClient } from "@akashnetwork/http-sdk";
import { inject, singleton } from "tsyringe";

import { SLACK_WEBHOOK_HTTP_CLIENT } from "@src/billing/providers/slack-webhook-client.provider";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { FeatureFlags } from "@src/core/services/feature-flags/feature-flags";
import { FeatureFlagsService } from "@src/core/services/feature-flags/feature-flags.service";
import type { ResponseTarget } from "@src/hardware-request/lib/hardware-request-response-schedule/hardware-request-response-schedule";
import type { HardwareRequestStatus } from "@src/hardware-request/model-schemas";
import { HARDWARE_REQUEST_CONFIG, type HardwareRequestConfig } from "@src/hardware-request/providers/config.provider";
import { type HardwareRequestOutput, HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";
import { HardwareRequestEventRepository } from "@src/hardware-request/repositories/hardware-request-event/hardware-request-event.repository";
import { HardwareRequestOfferRepository } from "@src/hardware-request/repositories/hardware-request-offer/hardware-request-offer.repository";
import { GpuRequestRoutingService } from "@src/hardware-request/services/gpu-request-routing/gpu-request-routing.service";
import { HardwareRequestAlertContextService } from "@src/hardware-request/services/hardware-request-alert-context/hardware-request-alert-context.service";
import { emailRecipientUserId } from "@src/notifications/lib/email-recipient-user-id/email-recipient-user-id";
import { NotificationService } from "@src/notifications/services/notification/notification.service";
import { responseTargetEmail, responseTargetEscalationSlackText, type ResponseTargetStage } from "./hardware-request-response-target-notice";

const SETTLED_STATUSES: HardwareRequestStatus[] = ["accepted", "fulfilled", "withdrawn", "closed"];

export class HardwareRequestResponseTargetJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestResponseTargetJob";
  readonly name = HardwareRequestResponseTargetJob[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { hardwareRequestId: string; target: ResponseTarget; stage: ResponseTargetStage; dueAt: string }) {}
}

/** Runs at the reminder and due times set when the request was filed, and does nothing once the target is met or the request is settled. */
@singleton()
export class HardwareRequestResponseTargetHandler implements JobHandler<HardwareRequestResponseTargetJob> {
  public readonly accepts = HardwareRequestResponseTargetJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly hardwareRequestOfferRepository: HardwareRequestOfferRepository,
    private readonly hardwareRequestEventRepository: HardwareRequestEventRepository,
    private readonly hardwareRequestAlertContextService: HardwareRequestAlertContextService,
    private readonly gpuRequestRoutingService: GpuRequestRoutingService,
    private readonly notificationService: NotificationService,
    private readonly featureFlagsService: FeatureFlagsService,
    @inject(HARDWARE_REQUEST_CONFIG) private readonly config: HardwareRequestConfig,
    @inject(SLACK_WEBHOOK_HTTP_CLIENT) private readonly slackWebhookClient: HttpClient,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestResponseTargetHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId, target, stage, dueAt }: JobPayload<HardwareRequestResponseTargetJob>): Promise<void> {
    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);

    if (!hardwareRequest) {
      this.#logger.warn({ event: "HARDWARE_REQUEST_RESPONSE_TARGET_SKIPPED", hardwareRequestId, reason: "Hardware request not found" });
      return;
    }

    if (SETTLED_STATUSES.includes(hardwareRequest.status) || (await this.#isMet(hardwareRequest, target))) return;

    const policy = this.gpuRequestRoutingService.getPolicy();
    const { owner } = await this.hardwareRequestAlertContextService.load(hardwareRequest);
    const notice = { hardwareRequest, target, stage, dueLabel: formatDue(dueAt, policy.businessHours.timeZone) };

    if (this.featureFlagsService.isEnabled(FeatureFlags.GPU_REQUEST_RESPONSE_TARGET_EMAILS)) {
      const email = (stage === "reminder" ? owner?.email : policy.salesLead?.email) ?? this.config.HARDWARE_REQUEST_EMAIL;

      await this.notificationService.createNotification(responseTargetEmail({ ...notice, recipient: { id: emailRecipientUserId(email), email } }));
    }

    if (
      stage === "escalation" &&
      this.config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL &&
      this.featureFlagsService.isEnabled(FeatureFlags.GPU_REQUEST_RESPONSE_TARGET_SLACK_ALERTS)
    ) {
      await this.slackWebhookClient.post(this.config.HARDWARE_REQUEST_SLACK_WEBHOOK_URL, {
        text: responseTargetEscalationSlackText({ ...notice, lead: policy.salesLead, owner })
      });
    }

    await this.hardwareRequestEventRepository.record({
      hardwareRequestId,
      type: stage === "reminder" ? "reminder_sent" : "escalated",
      actor: null,
      payload: { target }
    });
  }

  async #isMet(hardwareRequest: HardwareRequestOutput, target: ResponseTarget): Promise<boolean> {
    if (target === "first_reply") return !!hardwareRequest.firstRepliedAt;

    const offers = await this.hardwareRequestOfferRepository.findOldestFirst(hardwareRequest.id);

    return offers.some(offer => offer.publishedAt);
  }
}

function formatDue(dueAt: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  }).format(new Date(dueAt));
}
