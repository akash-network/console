import { addSeconds } from "date-fns";
import { inject, singleton } from "tsyringe";

import { type CreateLogger, LOGGER_FACTORY } from "@src/core/providers/logging.provider";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { ScreenUserGpuDeployment, screenUserGpuDeploymentKeyFor } from "@src/deployment/services/screen-user-gpu-deployment/screen-user-gpu-deployment.handler";
import { findCheckedGpuModel } from "@src/deployment/utils/checked-gpu-model/checked-gpu-model";
import { decodeCreateDeploymentMessage } from "@src/deployment/utils/create-deployment-message/create-deployment-message";

/** The configure page's wait for a first bid, so a deployment closed for lack of bids by then is never screened. */
const SCREEN_AFTER_SECONDS = 60;

@singleton()
export class UserGpuBidCheckService {
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#logger = createLogger({ context: UserGpuBidCheckService.name });
  }

  /** Never fails the create it follows, because the checks it schedules only feed analysis. */
  async scheduleFor({ dseq, message }: { dseq: string; message: string }): Promise<void> {
    try {
      const { id, groups } = decodeCreateDeploymentMessage(message).value;
      if (!id || !groups.some(group => findCheckedGpuModel(group))) return;

      await this.jobQueueService.enqueue(new ScreenUserGpuDeployment({ owner: id.owner, dseq }), {
        singletonKey: screenUserGpuDeploymentKeyFor(id.owner, dseq),
        startAfter: addSeconds(new Date(), SCREEN_AFTER_SECONDS).toISOString()
      });
    } catch (error) {
      this.#logger.warn({ event: "USER_GPU_BID_CHECK_NOT_SCHEDULED", dseq, error });
    }
  }
}
