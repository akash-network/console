import { inject, singleton } from "tsyringe";

import { type CreateLogger, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { GpuWinBackService } from "./gpu-win-back.service";
import { GpuWinBackCheck } from "./gpu-win-back-check.job";

@singleton()
export class GpuWinBackCheckHandler implements JobHandler<GpuWinBackCheck> {
  public readonly accepts = GpuWinBackCheck;

  /** One queued check per person, while a running check can still queue the one that follows it. */
  public readonly policy = "short";

  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly gpuWinBackService: GpuWinBackService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: GpuWinBackCheckHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ userId }: JobPayload<GpuWinBackCheck>): Promise<void> {
    const result = await this.gpuWinBackService.check(userId, new Date());

    this.#logger.info({ event: "GPU_WIN_BACK_CHECKED", userId, ...result });
  }
}
