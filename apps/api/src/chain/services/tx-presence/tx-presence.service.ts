import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";

export interface LandedTx {
  hash: string;
  code: number;
  height: number;
  rawLog: string;
}

/**
 * The one error a missing transaction produces, and the only one that may be read as an answer rather than a failure
 * to get one — matching how {@link DeploymentPresenceService} reads an absent deployment.
 */
function isTxAbsent(error: unknown): boolean {
  return error instanceof SDKError && error.code === SDKErrorCode.NotFound;
}

@singleton()
export class TxPresenceService {
  readonly #chainSdk: ChainSDK;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  /**
   * The transaction as the chain holds it, or null when the chain answered that it holds no such transaction. Anything
   * this cannot positively read as absent is rethrown, so a caller can never mistake an unreachable node for an answer.
   *
   * A null is weaker evidence than it looks: `REST_API_NODE_URL` is a pooled endpoint whose members sit at different
   * heights, and one far enough behind reports a landed transaction absent. Treat it as "not seen", not as "never
   * landed", wherever being wrong is expensive.
   */
  async findTx(hash: string): Promise<LandedTx | null> {
    try {
      const { txResponse } = await this.#chainSdk.cosmos.tx.v1beta1.getTx({ hash });

      if (!txResponse) {
        return null;
      }

      return { hash, code: txResponse.code, height: Number(txResponse.height), rawLog: txResponse.rawLog };
    } catch (error) {
      if (isTxAbsent(error)) return null;
      throw error;
    }
  }
}
