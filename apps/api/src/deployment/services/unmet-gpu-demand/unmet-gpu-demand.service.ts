import { inject, singleton } from "tsyringe";
import { z } from "zod";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { type GpuAsk, toAskToken, toDedupeKey } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import { UnmetDemandEventRepository } from "@src/deployment/repositories/unmet-demand-event/unmet-demand-event.repository";
import { RecordUnmetGpuScreening } from "@src/deployment/services/record-unmet-gpu-screening/record-unmet-gpu-screening.handler";

const EmptyScreeningSchema = z.object({ providers: z.array(z.unknown()).length(0) });

interface UnmetAsks {
  asks: GpuAsk[];
  actorId: string;
  occurredAt: Date;
}

/** Records best effort: a failure is logged and swallowed, so counting demand never fails or retries what the caller is doing. */
@singleton()
export class UnmetGpuDemandService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    private readonly unmetDemandEventRepository: UnmetDemandEventRepository,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: UnmetGpuDemandService.name });
  }

  /** Classifies in a job, since telling a missing model from one that did not fit reads provider snapshots the screening should not wait on. */
  async recordEmptyScreening(screening: unknown, { asks, actorId, occurredAt }: UnmetAsks): Promise<void> {
    if (!asks.length || !EmptyScreeningSchema.safeParse(screening).success) return;

    try {
      await this.jobQueueService.enqueue(
        new RecordUnmetGpuScreening({
          occurredAt: occurredAt.toISOString(),
          asks: asks.map(ask => ({ ...ask, askToken: toAskToken(ask, occurredAt, actorId) }))
        })
      );
    } catch (error) {
      this.#logger.error({ event: "UNMET_DEMAND_RECORD_FAILED", kind: "screening", error });
    }
  }

  async recordZeroBids({ asks, actorId, occurredAt }: UnmetAsks): Promise<void> {
    try {
      await this.unmetDemandEventRepository.insertMany(
        asks.map(ask => ({ ...ask, kind: "zero_bid", dedupeKey: toDedupeKey("zero_bid", toAskToken(ask, occurredAt, actorId)), occurredAt }))
      );
    } catch (error) {
      this.#logger.error({ event: "UNMET_DEMAND_RECORD_FAILED", kind: "zero_bid", error });
    }
  }
}
