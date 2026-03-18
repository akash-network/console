import { netConfig } from "@akashnetwork/net";
import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashTestnet: Chain = {
  ...akash,
  chain_id: netConfig.mapped("testnet"),
  network_type: "testnet",
  chain_name: "akash-testnet",
  pretty_name: "Akash-Testnet",
  apis: {
    rpc: [{ address: netConfig.getBaseRpcUrl("testnet"), provider: "ovrclk" }],
    rest: [{ address: netConfig.getBaseAPIUrl("testnet"), provider: "ovrclk" }]
  }
};

export const akashTestnetAssetList: AssetList = { ...akashAssetList, chain_name: "akash-testnet", assets: [...akashAssetList.assets] };
