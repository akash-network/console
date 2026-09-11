import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "@src/chain/providers/chain-sdk.provider";

export interface LandedTx {
  hash: string;
  code: number;
  height: number;
  rawLog: string;
}

/** The one error a missing tx produces, and so the only one readable as an answer rather than a failure to get one. */
function isTxAbsent(error: unknown): boolean {
  return error instanceof SDKError && error.code === SDKErrorCode.NotFound;
}

@singleton()
export class TxPresenceService {
  readonly #chainSdk: ChainSDK;

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  /** Null means "not seen", never "never landed": `REST_API_NODE_URL` is a pooled endpoint whose lagging members report a landed tx absent. */
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
