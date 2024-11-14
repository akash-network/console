import { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashSandbox: Chain = {
  ...akash,
  chain_id: "sandbox-01",
  network_type: "devnet",
  chain_name: "akash-sandbox",
  pretty_name: "Akash-Sandbox",
  apis: {
    rpc: [{ address: "https://rpc.sandbox-01.aksh.pw", provider: "ovrclk" }],
    rest: [{ address: "https://api.sandbox-01.aksh.pw", provider: "ovrclk" }]
  }
};

export const akashSandboxAssetList: AssetList = { ...akashAssetList, chain_name: "akash-sandbox", assets: [...akashAssetList.assets] };
