import { inject, singleton } from "tsyringe";

import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { AnalyticsService } from "@src/core/services/analytics/analytics.service";
import { HardwareRequestRepository } from "@src/hardware-request/repositories/hardware-request/hardware-request.repository";

export type HardwareRequestFunnelStep =
  | "gpu_request_created"
  | "gpu_request_first_reply"
  | "gpu_request_offer_published"
  | "gpu_request_accepted"
  | "gpu_request_closed";

type StepProperties = Record<string, string | number | null>;

const HOUR_MS = 60 * 60 * 1000;

export class HardwareRequestFunnelJob implements Job {
  static readonly [JOB_NAME] = "HardwareRequestFunnelJob";
  readonly name = HardwareRequestFunnelJob[JOB_NAME];
  readonly version = 1;

  constructor(
    public readonly data: { hardwareRequestId: string; step: HardwareRequestFunnelStep; stepKey: string; occurredAt: string; properties?: StepProperties }
  ) {}
}

/** Reports a step only once its transaction committed, keyed in Amplitude so a retried job counts once. */
@singleton()
export class HardwareRequestFunnelHandler implements JobHandler<HardwareRequestFunnelJob> {
  public readonly accepts = HardwareRequestFunnelJob;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly hardwareRequestRepository: HardwareRequestRepository,
    private readonly analyticsService: AnalyticsService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: HardwareRequestFunnelHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ hardwareRequestId, step, stepKey, occurredAt, properties }: JobPayload<HardwareRequestFunnelJob>): Promise<void> {
    const hardwareRequest = await this.hardwareRequestRepository.findById(hardwareRequestId);

    if (!hardwareRequest?.userId) {
      this.#logger.info({
        event: "HARDWARE_REQUEST_FUNNEL_STEP_SKIPPED",
        hardwareRequestId,
        step,
        reason: hardwareRequest ? "Request has no account yet" : "Hardware request not found"
      });
      return;
    }

    const { userId, lane, estimatedMonthlyUsd, source, createdAt } = hardwareRequest;
    const hoursSinceRequest = Math.round(((new Date(occurredAt).getTime() - new Date(createdAt).getTime()) / HOUR_MS) * 10) / 10;

    this.analyticsService.track(
      userId,
      step,
      { hardwareRequestId, lane, estimatedMonthlyUsd, source, hoursSinceRequest, ...properties },
      { insertId: `${step}:${stepKey}` }
    );
  }
}
