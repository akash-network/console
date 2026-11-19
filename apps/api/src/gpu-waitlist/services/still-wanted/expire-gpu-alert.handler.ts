import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, JobQueueService, LOGGER_FACTORY } from "@src/core";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { ExpireGpuAlert } from "./expire-gpu-alert.job";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_REQUEUE_DELAY_MS = 60 * 1000;

@singleton()
export class ExpireGpuAlertHandler implements JobHandler<ExpireGpuAlert> {
  public readonly accepts = ExpireGpuAlert;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    private readonly jobQueueService: JobQueueService,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ExpireGpuAlertHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ entryId }: JobPayload<ExpireGpuAlert>): Promise<void> {
    const expired = await this.gpuWaitlistEntryRepository.expireUnansweredQuestion(entryId, this.config.GPU_WAITLIST_STILL_WANTED_GRACE_DAYS);

    if (expired) {
      this.#logger.info({ event: "GPU_ALERT_EXPIRED", entryId });
      return;
    }

    await this.#requeueWhenQuestionIsStillPending(entryId);
  }

  async #requeueWhenQuestionIsStillPending(entryId: string): Promise<void> {
    const entry = await this.gpuWaitlistEntryRepository.findByIdAcrossOrganizations(entryId);

    if (entry?.status !== "waiting" || !entry.stillWantedAskedAt) {
      this.#logger.info({ event: "GPU_ALERT_EXPIRY_SKIPPED", entryId, reason: entry ? "Entry is no longer waiting on an answer" : "Entry not found" });
      return;
    }

    const dueAt = entry.stillWantedAskedAt.getTime() + this.config.GPU_WAITLIST_STILL_WANTED_GRACE_DAYS * DAY_MS;
    await this.jobQueueService.enqueue(new ExpireGpuAlert({ entryId }), { startAfter: new Date(Math.max(dueAt, Date.now() + MIN_REQUEUE_DELAY_MS)) });
    this.#logger.info({ event: "GPU_ALERT_EXPIRY_REQUEUED", entryId });
  }
}
