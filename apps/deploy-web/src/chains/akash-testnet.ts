import { netConfig } from "@akashnetwork/net";
import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashTestnet: Chain = {
  ...akash,
  chain_id: safe(() => netConfig.mapped("testnet")) ?? "testnet",
  network_type: "testnet",
  chain_name: "akash-testnet",
  pretty_name: "Akash-Testnet",
  apis: {
    rpc: [{ address: safe(() => netConfig.getBaseRpcUrl("testnet")) ?? "", provider: "ovrclk" }],
    rest: [{ address: safe(() => netConfig.getBaseAPIUrl("testnet")) ?? "", provider: "ovrclk" }]
  }
};

export const akashTestnetAssetList: AssetList = { ...akashAssetList, chain_name: "akash-testnet", assets: [...akashAssetList.assets] };

function safe<T extends (...args: any[]) => any>(fn: T): ReturnType<T> | null {
  try {
    return fn();
  } catch {
    return null;
  }
}
