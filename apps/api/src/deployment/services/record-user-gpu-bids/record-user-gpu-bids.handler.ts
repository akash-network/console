import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import type { GpuAsk } from "@src/deployment/lib/unmet-gpu-ask/unmet-gpu-ask";
import { type CheckedGpuModel, type GpuBidCheckInsert, GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { UnmetGpuDemandService } from "@src/deployment/services/unmet-gpu-demand/unmet-gpu-demand.service";
import { findDeploymentBids } from "@src/deployment/utils/find-deployment-bids/find-deployment-bids";
import type { RegionArea } from "@src/gpu/lib/region-area/region-area";

export interface ScreenedGpuGroup extends CheckedGpuModel {
  gseq: number;
  screened: string[];
  /** False for a group leased before the configure page's wait ended, which stopped taking bids early. */
  wasOpenThroughWait: boolean;
  /** Absent on a job queued before unmet demand was recorded, which then records no zero bid for the group. */
  gpuCount?: number;
  regionArea?: RegionArea | null;
}

export class RecordUserGpuBids implements Job {
  static readonly [JOB_NAME] = "RecordUserGpuBids";
  readonly name = RecordUserGpuBids[JOB_NAME];
  readonly version = 1;

  constructor(public readonly data: { owner: string; dseq: string; groups: ScreenedGpuGroup[] }) {}
}

export function recordUserGpuBidsKeyFor(owner: string, dseq: string): string {
  return `recordUserGpuBids.${owner}.${dseq}`;
}

@singleton()
export class RecordUserGpuBidsHandler implements JobHandler<RecordUserGpuBids> {
  public readonly accepts = RecordUserGpuBids;
  readonly #chainSdk: ChainSDK;

  constructor(
    @inject(CHAIN_SDK) chainSdk: ChainSDK,
    private readonly gpuBidCheckRepository: GpuBidCheckRepository,
    private readonly unmetGpuDemandService: UnmetGpuDemandService
  ) {
    this.#chainSdk = chainSdk;
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  /** Records a deployment closed or leased since screening too, since the chain keeps its closed bids and misses are judged on the configure page's wait, which had already ended. */
  async handle({ owner, dseq, groups }: JobPayload<RecordUserGpuBids>): Promise<void> {
    const bids = await findDeploymentBids(this.#chainSdk, owner, dseq);
    const checkedAt = new Date();

    await this.gpuBidCheckRepository.insertMany(groups.flatMap(group => toCheckRows(group, bids, dseq, checkedAt)));
    await this.unmetGpuDemandService.recordZeroBids({ asks: findZeroBidAsks(groups, bids), actorId: owner, occurredAt: checkedAt });
  }
}

/** A group leased early counts only the providers that bid on it, since the others had less than the wait to do so. */
function toCheckRows({ gseq, vendor, model, screened, wasOpenThroughWait }: ScreenedGpuGroup, bids: Bid[], dseq: string, checkedAt: Date): GpuBidCheckInsert[] {
  const bidders = new Set(bids.flatMap(({ id }) => (id?.gseq === gseq ? [id.provider] : [])));
  const providers = new Set([...(wasOpenThroughWait ? screened : []), ...bidders]);

  return [...providers].map(provider => ({
    provider,
    vendor,
    model,
    source: "user-deployment",
    dseq,
    screened: screened.includes(provider),
    bid: bidders.has(provider),
    checkedAt
  }));
}

/** Only a group that stayed open through the wait and drew no bid at all counts, the same groups a silent provider is judged on. */
function findZeroBidAsks(groups: ScreenedGpuGroup[], bids: Bid[]): GpuAsk[] {
  const biddedGseqs = new Set(bids.flatMap(({ id }) => (id ? [id.gseq] : [])));

  return groups.flatMap(({ gseq, vendor, model, wasOpenThroughWait, gpuCount, regionArea }) =>
    wasOpenThroughWait && gpuCount !== undefined && !biddedGseqs.has(gseq) ? [{ vendor, model, gpuCount, regionArea: regionArea ?? null }] : []
  );
}
