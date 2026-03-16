import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashTestnet: Chain = {
  ...akash,
  chain_id: "testnet-upgrade",
  network_type: "testnet",
  chain_name: "akash-testnet",
  pretty_name: "Akash-Testnet",
  apis: {
    rpc: [{ address: "https://rpc.testnet-upgrade.aksh.pw:443", provider: "ovrclk" }],
    rest: [{ address: "https://api.testnet-upgrade.aksh.pw:443", provider: "ovrclk" }]
  }
};

export const akashTestnetAssetList: AssetList = { ...akashAssetList, chain_name: "akash-testnet", assets: [...akashAssetList.assets] };
