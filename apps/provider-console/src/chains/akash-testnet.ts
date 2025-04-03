import type { AssetList } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashTestnet = {
  ...akash,
  chain_id: "testnet-02",
  network_type: "testnet",
  chain_name: "akash-testnet",
  pretty_name: "Akash-Testnet",
  apis: {
    rpc: [{ address: "https://rpc.testnet-02.aksh.pw", provider: "ovrclk" }],
    rest: [{ address: "https://api.testnet-02.aksh.pw", provider: "ovrclk" }]
  }
};

export const akashTestnetAssetList: AssetList = { ...akashAssetList, chain_name: "akash-testnet", assets: [...akashAssetList.assets] };
