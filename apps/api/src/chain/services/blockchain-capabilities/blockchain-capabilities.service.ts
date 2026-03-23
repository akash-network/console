import { gte } from "semver";
import { inject, singleton } from "tsyringe";

import { CHAIN_SDK, type ChainSDK } from "../../providers/chain-sdk.provider";

type Capability = "ACT";

@singleton()
export class BlockchainCapabilitiesService {
  readonly #chainSdk: ChainSDK;
  readonly #capabilities: Partial<Record<Capability, Promise<boolean>>> = {};

  constructor(@inject(CHAIN_SDK) chainSdk: ChainSDK) {
    this.#chainSdk = chainSdk;
  }

  async supportsACT(): Promise<boolean> {
    this.#capabilities.ACT ??= this.#chainSdk.cosmos.base.tendermint.v1beta1
      .getNodeInfo()
      .then(nodeInfo => {
        const appVersion = nodeInfo?.applicationVersion?.version?.startsWith("v")
          ? nodeInfo.applicationVersion.version.slice(1)
          : nodeInfo?.applicationVersion?.version;
        return !!appVersion && gte(appVersion, "2.0.0-rc1");
      })
      .catch(error => {
        this.#capabilities.ACT = undefined;
        return Promise.reject(error);
      });
    return this.#capabilities.ACT;
  }
}
