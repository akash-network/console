import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashSandbox: Chain = {
  ...akash,
  chain_id: "sandbox-2",
  network_type: "devnet",
  chain_name: "akash-sandbox",
  pretty_name: "Akash-Sandbox",
  apis: {
    rpc: [{ address: "https://rpc.sandbox-2.aksh.pw:443", provider: "ovrclk" }],
    rest: [{ address: "https://api.sandbox-2.aksh.pw:443", provider: "ovrclk" }]
  }
};

export const akashSandboxAssetList: AssetList = { ...akashAssetList, chain_name: "akash-sandbox", assets: [...akashAssetList.assets] };
