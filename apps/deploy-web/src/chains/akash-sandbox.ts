import { netConfig } from "@akashnetwork/net";
import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashSandbox: Chain = {
  ...akash,
  chain_id: netConfig.mapped("sandbox"),
  network_type: "devnet",
  chain_name: "akash-sandbox",
  pretty_name: "Akash-Sandbox",
  apis: {
    rpc: [{ address: netConfig.getBaseRpcUrl("sandbox"), provider: "ovrclk" }],
    rest: [{ address: netConfig.getBaseAPIUrl("sandbox"), provider: "ovrclk" }]
  }
};

export const akashSandboxAssetList: AssetList = { ...akashAssetList, chain_name: "akash-sandbox", assets: [...akashAssetList.assets] };
