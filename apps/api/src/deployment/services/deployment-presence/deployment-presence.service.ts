import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";

/**
 * The one error a missing deployment produces, and the only one that may be read as an answer rather than a
 * failure to get one. Verified against two independent mainnet REST nodes: an absent deployment returns
 * `HTTP 404 {"code":5,...}`, which the SDK's grpc-gateway transport turns into an `SDKError` carrying
 * `NotFound`. Every other outcome carries a different code — a malformed owner is `InvalidArgument`, a node
 * that does not serve this query version is `Unimplemented`, an unreachable host or a DNS failure is
 * `Unknown`, and a timeout is `DeadlineExceeded` — so none of them can be mistaken for an answer.
 */
function isDeploymentAbsent(error: unknown): boolean {
  return error instanceof SDKError && error.code === SDKErrorCode.NotFound;
}

@singleton()
export class DeploymentPresenceService {
  readonly #chainSdk: ChainSDK;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  /**
   * Whether the chain holds this deployment, in any state. Answers only when the chain answered: any outcome
   * this cannot positively read as "absent" is rethrown, so a caller that deletes on `false` can never delete
   * because a node was unreachable. A response the node served is read as present without inspecting its body,
   * because the cost of the two mistakes is not symmetric — believing a live deployment gone destroys the only
   * copy of its SDL and silently drops its runtime limit, while believing a gone deployment live merely leaves
   * a row nothing reads.
   */
  async isOnChain({ owner, dseq }: { owner: string; dseq: string }): Promise<boolean> {
    try {
      await this.#chainSdk.akash.deployment.v1beta4.getDeployment({ id: { owner, dseq: BigInt(dseq) } });
      return true;
    } catch (error) {
      if (isDeploymentAbsent(error)) return false;
      throw error;
    }
  }
}
