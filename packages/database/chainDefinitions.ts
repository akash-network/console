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
  },
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
