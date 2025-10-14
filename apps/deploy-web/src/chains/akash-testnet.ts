import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashTestnet: Chain = {
  ...akash,
  chain_id: "testnet-7",
  network_type: "testnet",
  chain_name: "akash-testnet",
  pretty_name: "Akash-Testnet",
  apis: {
    rpc: [{ address: "https://testnetrpc.akashnet.net", provider: "ovrclk" }],
    rest: [{ address: "https://testnetapi.akashnet.net", provider: "ovrclk" }]
  }
};

export const akashTestnetAssetList: AssetList = { ...akashAssetList, chain_name: "akash-testnet", assets: [...akashAssetList.assets] };
