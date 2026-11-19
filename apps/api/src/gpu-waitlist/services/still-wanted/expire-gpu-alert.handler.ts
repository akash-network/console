import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { GPU_WAITLIST_CONFIG, type GpuWaitlistConfig } from "@src/gpu-waitlist/providers/config.provider";
import { GpuWaitlistEntryRepository, type GpuWaitlistEntryRow } from "@src/gpu-waitlist/repositories/gpu-waitlist-entry/gpu-waitlist-entry.repository";
import { ExpireGpuAlert } from "./expire-gpu-alert.job";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The queue clock and this process's clock can differ slightly, and a job read as early would leave the entry waiting forever. */
const CLOCK_SKEW_TOLERANCE_MS = 60 * 1000;

@singleton()
export class ExpireGpuAlertHandler implements JobHandler<ExpireGpuAlert> {
  public readonly accepts = ExpireGpuAlert;

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWaitlistEntryRepository: GpuWaitlistEntryRepository,
    @inject(GPU_WAITLIST_CONFIG) private readonly config: GpuWaitlistConfig,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: ExpireGpuAlertHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ entryId }: JobPayload<ExpireGpuAlert>): Promise<void> {
    const entry = await this.gpuWaitlistEntryRepository.findByIdAcrossOrganizations(entryId);
    const skipReason = this.#skipReasonFor(entry);

    if (skipReason) {
      this.#logger.info({ event: "GPU_ALERT_EXPIRY_SKIPPED", entryId, reason: skipReason });
      return;
    }

    await this.gpuWaitlistEntryRepository.unscoped("gpu-waitlist-watcher").updateById(entryId, { status: "expired", endedAt: new Date() });
    this.#logger.info({ event: "GPU_ALERT_EXPIRED", entryId });
  }

  #skipReasonFor(entry: GpuWaitlistEntryRow | undefined): string | undefined {
    if (!entry) return "Entry not found";
    if (entry.status !== "waiting") return "Entry is no longer waiting";
    if (!entry.stillWantedAskedAt) return "Entry was kept";

    const graceMs = this.config.GPU_WAITLIST_STILL_WANTED_GRACE_DAYS * DAY_MS;
    const askedMs = Date.now() - entry.stillWantedAskedAt.getTime();

    return askedMs + CLOCK_SKEW_TOLERANCE_MS < graceMs ? "Grace period has not passed" : undefined;
  }
}
