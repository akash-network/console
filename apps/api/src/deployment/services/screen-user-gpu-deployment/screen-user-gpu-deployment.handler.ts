import { Deployment_State } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { QueryDeploymentResponse } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { addMinutes } from "date-fns";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type CreateLogger, type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions, LOGGER_FACTORY } from "@src/core";
import { JobQueueService } from "@src/core/services/job-queue/job-queue.service";
import { BidScreeningHttpService } from "@src/deployment/services/bid-screening-http/bid-screening-http.service";
import { RecordUserGpuBids, recordUserGpuBidsKeyFor } from "@src/deployment/services/record-user-gpu-bids/record-user-gpu-bids.handler";
import { findCheckedGpuModel } from "@src/deployment/utils/checked-gpu-model/checked-gpu-model";

/** Gives bids that land after the configure page's wait time to arrive before they are read. */
const RECORD_AFTER_MINUTES = 4;

export class ScreenUserGpuDeployment implements Job {
  static readonly [JOB_NAME] = "ScreenUserGpuDeployment";
  readonly name = ScreenUserGpuDeployment[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { owner: string; dseq: string }) {}
}

export function screenUserGpuDeploymentKeyFor(owner: string, dseq: string): string {
  return `screenUserGpuDeployment.${owner}.${dseq}`;
}

@singleton()
export class ScreenUserGpuDeploymentHandler implements JobHandler<ScreenUserGpuDeployment> {
  public readonly accepts = ScreenUserGpuDeployment;
  readonly #chainSdk: ChainSDK;
  readonly #logger: ReturnType<CreateLogger>;

  constructor(
    @inject(CHAIN_SDK) chainSdk: ChainSDK,
    private readonly bidScreeningHttpService: BidScreeningHttpService,
    private readonly jobQueueService: JobQueueService,
    @inject(LOGGER_FACTORY) createLogger: CreateLogger
  ) {
    this.#chainSdk = chainSdk;
    this.#logger = createLogger({ context: ScreenUserGpuDeploymentHandler.name });
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** A deployment closed before the wait ended, or never created, records nothing, so no provider is blamed for it. */
  async handle({ owner, dseq }: JobPayload<ScreenUserGpuDeployment>): Promise<void> {
    const deployment = await this.#findActiveDeployment(owner, dseq);
    if (!deployment) {
      this.#logger.info({ event: "USER_GPU_DEPLOYMENT_NOT_ACTIVE", owner, dseq });
      return;
    }

    const groups = deployment.groups.flatMap(({ id, groupSpec }) => {
      const model = groupSpec && findCheckedGpuModel(groupSpec);
      return id && groupSpec && model ? [{ gseq: id.gseq, groupSpec, ...model }] : [];
    });
    if (!groups.length) return;

    const [screened, openGseqs] = await Promise.all([
      Promise.all(groups.map(({ groupSpec }) => this.bidScreeningHttpService.findScreenedProviders(groupSpec))),
      this.#findOpenOrderGseqs(owner, dseq)
    ]);

    await this.jobQueueService.enqueue(
      new RecordUserGpuBids({
        owner,
        dseq,
        groups: groups.map(({ gseq, vendor, model }, index) => ({ gseq, vendor, model, screened: screened[index], wasOpenThroughWait: openGseqs.has(gseq) }))
      }),
      { singletonKey: recordUserGpuBidsKeyFor(owner, dseq), startAfter: addMinutes(new Date(), RECORD_AFTER_MINUTES).toISOString() }
    );
  }

  async #findActiveDeployment(owner: string, dseq: string): Promise<QueryDeploymentResponse | null> {
    try {
      const response = await this.#chainSdk.akash.deployment.v1beta4.getDeployment({ id: { owner, dseq: BigInt(dseq) } });
      return response.deployment?.state === Deployment_State.active ? response : null;
    } catch (error) {
      if (error instanceof SDKError && error.code === SDKErrorCode.NotFound) return null;
      throw error;
    }
  }

  async #findOpenOrderGseqs(owner: string, dseq: string): Promise<Set<number>> {
    const { orders } = await this.#chainSdk.akash.market.v1beta5.getOrders({ filters: { owner, dseq: BigInt(dseq), state: "open" } });
    return new Set(orders.flatMap(({ id }) => (id ? [id.gseq] : [])));
  }
}
