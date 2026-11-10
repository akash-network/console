import { singleton } from "tsyringe";

import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { classifyEmptyScreening, type GpuAsk, toDedupeKey } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import { UnmetDemandEventRepository } from "@src/deployment/repositories/unmet-demand-event/unmet-demand-event.repository";
import { GpuService } from "@src/gpu/services/gpu.service";

export interface TokenizedGpuAsk extends GpuAsk {
  askToken: string;
}

/** Carries each ask's token rather than the asker, so the queue never stores who asked. */
export class RecordUnmetGpuScreening implements Job {
  static readonly [JOB_NAME] = "RecordUnmetGpuScreening";
  readonly name = RecordUnmetGpuScreening[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { occurredAt: string; asks: TokenizedGpuAsk[] }) {}
}

@singleton()
export class RecordUnmetGpuScreeningHandler implements JobHandler<RecordUnmetGpuScreening> {
  public readonly accepts = RecordUnmetGpuScreening;

  constructor(
    private readonly gpuService: GpuService,
    private readonly unmetDemandEventRepository: UnmetDemandEventRepository
  ) {}

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ occurredAt, asks }: JobPayload<RecordUnmetGpuScreening>): Promise<void> {
    const offeredModels = await this.gpuService.findOfferedGpuModels();

    await this.unmetDemandEventRepository.insertMany(
      asks.map(({ askToken, ...ask }) => {
        const kind = classifyEmptyScreening(ask, offeredModels);
        return { ...ask, kind, dedupeKey: toDedupeKey(kind, askToken), occurredAt: new Date(occurredAt) };
      })
    );
  }
}
