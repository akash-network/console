import type { Bid } from "@akashnetwork/chain-sdk/private-types/akash.v1beta5";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";
import { type Job, JOB_NAME, type JobHandler, type JobPayload, type JobPermissions } from "@src/core";
import { type CheckedGpuModel, type GpuBidCheckInsert, GpuBidCheckRepository } from "@src/deployment/repositories/gpu-bid-check/gpu-bid-check.repository";
import { findDeploymentBids } from "@src/deployment/utils/find-deployment-bids/find-deployment-bids";

export interface ScreenedGpuGroup extends CheckedGpuModel {
  gseq: number;
  screened: string[];
  /** False for a group leased before the configure page's wait ended, which stopped taking bids early. */
  wasOpenThroughWait: boolean;
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
    private readonly gpuBidCheckRepository: GpuBidCheckRepository
  ) {
    this.#chainSdk = chainSdk;
  }

  requiresPermission(): JobPermissions {
    return [];
  }

  async handle({ owner, dseq, groups }: JobPayload<RecordUserGpuBids>): Promise<void> {
    const bids = await findDeploymentBids(this.#chainSdk, owner, dseq);
    const checkedAt = new Date();

    await this.gpuBidCheckRepository.insertMany(groups.flatMap(group => toCheckRows(group, bids, dseq, checkedAt)));
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
