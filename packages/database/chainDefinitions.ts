import * as dotenv from "dotenv";
import { Model, ModelCtor } from "sequelize-typescript";

import {
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
  ProviderSnapshotStorage
} from "./dbSchemas/akash";
import { Block, Message } from "./dbSchemas/base";
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
    rpcNodes: [
      "http://akash.c29r3.xyz/rpc",
      "https://akash-rpc.lavenderfive.com",
      "https://rpc-akash.ecostake.com",
      "https://rpc.akash.forbole.com",
      "https://akash-rpc.polkachu.com",
      "https://akash-mainnet-rpc.cosmonautstakes.com",
      "https://rpc-akash-ia.cosmosia.notional.ventures",
      "https://akash-rpc.kleomedes.network"
    ],
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_DATABASE_CS,
    genesisFileUrl: "https://raw.githubusercontent.com/akash-network/net/master/mainnet/genesis.json",
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer"],
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
      ProviderSnapshotStorage
    ]
  },
  akashTestnet: {
    code: "akash-testnet",
    rpcNodes: ["https://rpc.testnet-02.aksh.pw:443", "https://akash-testnet-rpc.cosmonautstakes.com:443"],
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_TESTNET_DATABASE_CS,
    genesisFileUrl: "https://raw.githubusercontent.com/akash-network/net/master/testnet-02/genesis.json",
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer"],
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
      ProviderSnapshotStorage
    ]
  },
  akashSandbox: {
    code: "akash-sandbox",
    rpcNodes: ["https://rpc.sandbox-01.aksh.pw"],
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_SANDBOX_DATABASE_CS,
    genesisFileUrl: "https://raw.githubusercontent.com/akash-network/net/master/sandbox/genesis.json",
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer"],
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
      ProviderSnapshotStorage
    ]
  }
};

export const activeChain = chainDefinitions[process.env.ACTIVE_CHAIN || "akash"];
