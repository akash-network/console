import { netConfig } from "@akashnetwork/net";
import * as dotenv from "dotenv";
import type { Model, ModelCtor } from "sequelize-typescript";

import {
  AkashBlock,
  AkashMessage,
  Bid,
  BmeLedgerRecord,
  BmeRawEvent,
  BmeStatusChange,
  Deployment,
  DeploymentGroup,
  DeploymentGroupResource,
  Lease,
  Provider,
  ProviderAttribute,
  ProviderAttributeSignature,
  ProviderSnapshot,
  ProviderSnapshotNode,
  ProviderSnapshotNodeCPU,
  ProviderSnapshotNodeGPU,
  ProviderSnapshotStorage
} from "./dbSchemas/akash";
import type { Block, Message } from "./dbSchemas/base";
dotenv.config({ path: ".env.local" });
dotenv.config();

// Derived from the module name hash, so it's the same across all networks
export const BME_VAULT_ADDRESS = "akash1klpwzlvfnw7j8gtdd0cuu9vaw9ermsmd37sg55";

/** Known axlUSDC IBC denoms across networks (must match node/upgrades/software/v2.0.0/deployment.go) */
export const IBC_USDC_DENOMS = [
  "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1", // mainnet
  "ibc/028CD1864059EEFB48A6048376165318E3E82C234390AE5A6D7B22001725B06E" // sandbox
];

export interface ChainDef {
  code: string;
  rpcNodes: string[];
  cosmosDirectoryId: string;
  connectionString: string | undefined;
  genesisFileUrl: string;
  coinGeckoId: string | null;
  logoUrlSVG?: string;
  logoUrlPNG?: string;
  customIndexers: string[];
  bech32Prefix: string;
  denom: string;
  udenom: string;
  startHeight?: number;
  customBlockModel?: ModelCtor<Block>;
  customMessageModel?: ModelCtor<Message>;
  customModels?: ModelCtor<Model<any, any>>[];
}

export const chainDefinitions: { [key: string]: ChainDef } = {
  akash: {
    code: "akash",
    rpcNodes: netConfig.getAllBaseRpcUrls("mainnet"),
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_DATABASE_CS,
    genesisFileUrl: `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("mainnet")}/genesis.json`,
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer", "BmeIndexer"],
    bech32Prefix: "akash",
    denom: "akt",
    udenom: "uakt",
    customBlockModel: AkashBlock,
    customMessageModel: AkashMessage,
    customModels: [
      AkashBlock,
      AkashMessage,
      Bid,
      Deployment,
      DeploymentGroup,
      DeploymentGroupResource,
      Lease,
      Provider,
      ProviderAttribute,
      ProviderAttributeSignature,
      ProviderSnapshot,
      ProviderSnapshotNode,
      ProviderSnapshotNodeCPU,
      ProviderSnapshotNodeGPU,
      ProviderSnapshotStorage,
      BmeLedgerRecord,
      BmeRawEvent,
      BmeStatusChange
    ]
  },
  ...(netConfig.isSupported("testnet") && {
    akashTestnet: {
      code: "akash-testnet",
      rpcNodes: netConfig.getAllBaseRpcUrls("testnet"),
      cosmosDirectoryId: "akash",
      connectionString: process.env.AKASH_TESTNET_DATABASE_CS,
      genesisFileUrl: `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("testnet")}/genesis.json`,
      coinGeckoId: "akash-network",
      logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
      logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
      customIndexers: ["AkashStatsIndexer", "BmeIndexer"],
      bech32Prefix: "akash",
      denom: "act",
      udenom: "uact",
      customBlockModel: AkashBlock,
      customMessageModel: AkashMessage,
      customModels: [
        AkashBlock,
        AkashMessage,
        Bid,
        Deployment,
        DeploymentGroup,
        DeploymentGroupResource,
        Lease,
        Provider,
        ProviderAttribute,
        ProviderAttributeSignature,
        ProviderSnapshot,
        ProviderSnapshotNode,
        ProviderSnapshotNodeCPU,
        ProviderSnapshotNodeGPU,
        ProviderSnapshotStorage,
        BmeLedgerRecord,
        BmeRawEvent,
        BmeStatusChange
      ]
    }
  }),
  akashSandbox: {
    code: "akash-sandbox",
    rpcNodes: netConfig.getAllBaseRpcUrls("sandbox"),
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_SANDBOX_DATABASE_CS,
    genesisFileUrl: `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("sandbox")}/genesis.json`,
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer", "BmeIndexer"],
    bech32Prefix: "akash",
    denom: "akt",
    udenom: "uakt",
    customBlockModel: AkashBlock,
    customMessageModel: AkashMessage,
    customModels: [
      AkashBlock,
      AkashMessage,
      Bid,
      Deployment,
      DeploymentGroup,
      DeploymentGroupResource,
      Lease,
      Provider,
      ProviderAttribute,
      ProviderAttributeSignature,
      ProviderSnapshot,
      ProviderSnapshotNode,
      ProviderSnapshotNodeCPU,
      ProviderSnapshotNodeGPU,
      ProviderSnapshotStorage,
      BmeLedgerRecord,
      BmeRawEvent,
      BmeStatusChange
    ]
  }
};

export const activeChain = chainDefinitions[process.env.ACTIVE_CHAIN || "akash"];
