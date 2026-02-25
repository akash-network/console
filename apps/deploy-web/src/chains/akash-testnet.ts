import type { AssetList, Chain } from "@chain-registry/types";

import { akash, akashAssetList } from "./akash";

export const akashTestnet: Chain = {
  ...akash,
  chain_id: "testnet-8",
  network_type: "testnet",
  chain_name: "akash-testnet",
  pretty_name: "Akash-Testnet",
  apis: {
    rpc: [{ address: "https://testnetrpc.akashnet.net", provider: "ovrclk" }],
    rest: [{ address: "https://testnetapi.akashnet.net", provider: "ovrclk" }]
  },
  fees: {
    fee_tokens: [
      {
        denom: "uact",
        fixed_min_gas_price: 0.00025,
        low_gas_price: 0.00025,
        average_gas_price: 0.0025,
        high_gas_price: 0.025
      }
    ]
  },
  staking: {
    staking_tokens: [
      {
        denom: "uact"
      }
    ]
  }
};

export const akashTestnetAssetList: AssetList = { ...akashAssetList, chain_name: "akash-testnet", assets: [...akashAssetList.assets] };
