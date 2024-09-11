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
    connectionString: process.env.AkashTestnetDatabaseCS,
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
    connectionString: process.env.AkashSandboxDatabaseCS,
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
  },
  passage: {
    code: "passage",
    rpcNodes: [
      "https://rpc-passage.ecostake.com",
      "https://rpc-passage-ia.cosmosia.notional.ventures",
      "https://services.staketab.com/passage-rpc",
      "https://passage-rpc.panthea.eu",
      "https://passage-rpc.polkachu.com",
      "https://rpc.passage.vitwit.com"
    ],
    cosmosDirectoryId: "passage",
    connectionString: process.env.PassageDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/envadiv/mainnet/main/passage-1/genesis.json",
    coinGeckoId: null,
    customIndexers: [],
    bech32Prefix: "pasg",
    denom: "pasg",
    udenom: "upasg"
  },
  juno: {
    code: "juno",
    rpcNodes: [
      "https://rpc-juno.ecostake.com",
      "https://rpc.juno.pupmos.network",
      "https://rpc.juno.interbloc.org",
      "https://rpc-juno.itastakers.com",
      "https://juno-rpc.polkachu.com",
      "https://juno-rpc.lavenderfive.com:443",
      "https://rpc.juno.chaintools.tech",
      "https://rpc-juno-ia.cosmosia.notional.ventures",
      "https://rpc-juno.whispernode.com",
      "https://juno-rpc.reece.sh"
    ],
    cosmosDirectoryId: "juno",
    connectionString: process.env.JunoDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/CosmosContracts/mainnet/main/juno-1/genesis.json",
    coinGeckoId: "juno-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/juno/images/juno.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/juno.png",
    customIndexers: [],
    bech32Prefix: "juno",
    denom: "juno",
    udenom: "ujuno",
    startHeight: 9_426_289
  },
  cosmos: {
    code: "cosmos",
    rpcNodes: [
      "https://rpc-cosmoshub.ecostake.com",
      "https://rpc-cosmoshub.goldenratiostaking.net",
      "https://cosmoshub-rpc.lavenderfive.com:443",
      "https://rpc.cosmos.dragonstake.io",
      "https://cosmos-rpc.icycro.org",
      "https://cosmos-rpc.quickapi.com:443",
      "https://cosmoshub.rpc.stakin.com",
      "https://rpc-cosmoshub-ia.cosmosia.notional.ventures",
      "https://rpc.cosmoshub.pupmos.network",
      "https://cosmos-rpc.polkachu.com",
      "https://rpc.cosmoshub.strange.love",
      "https://cosmoshub.rpc.interchain.ivaldilabs.xyz",
      "https://rpc.cosmos.silknodes.io",
      "https://rpc.cosmos.network:443",
      "https://rpc-cosmoshub.architectnodes.com",
      "https://rpc-cosmoshub.blockapsis.com",
      "https://rpc-cosmoshub.whispernode.com"
    ],
    cosmosDirectoryId: "cosmoshub",
    connectionString: process.env.CosmosDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/cosmos/mainnet/master/genesis/genesis.cosmoshub-4.json.gz",
    coinGeckoId: "cosmos",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/cosmoshub/images/atom.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/atom.png",
    customIndexers: [],
    bech32Prefix: "cosmos",
    denom: "atom",
    udenom: "uatom",
    startHeight: 16_416_294
  },
  osmosis: {
    code: "osmosis",
    rpcNodes: [
      "https://rpc-osmosis-ia.cosmosia.notional.ventures",
      "https://osmosis.rpc.stakin-nodes.com",
      "https://rpc-osmosis.ecostake.com",
      "https://rpc.osmosis.zone",
      "https://osmosis-rpc.polkachu.com",
      "https://osmosis-rpc.quickapi.com:443",
      "https://osmosis-rpc.ibs.team",
      "https://osmosis-rpc.lavenderfive.com:443",
      "https://rpc-osmosis.blockapsis.com",
      "https://rpc.osmosis.silknodes.io",
      "https://osmosis.rpc.chandrastation.com:443"
    ],
    cosmosDirectoryId: "osmosis",
    connectionString: process.env.OsmosisDatabaseCS,
    genesisFileUrl: "https://github.com/osmosis-labs/networks/blob/main/osmosis-1/genesis.json",
    coinGeckoId: "osmosis",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/osmosis/images/osmo.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/osmo.png",
    customIndexers: [],
    bech32Prefix: "osmo",
    denom: "osmo",
    udenom: "uosmo",
    startHeight: 10_817_394
  },
  stargaze: {
    code: "stargaze",
    rpcNodes: [
      "https://rpc.stargaze-apis.com",
      "https://stargaze-rpc.polkachu.com",
      "https://rpc-stargaze.pupmos.network",
      "https://rpc-stargaze-ia.cosmosia.notional.ventures",
      "https://rpc-stargaze.d-stake.xyz",
      "https://rpc.stargaze.silentvalidator.com",
      "https://stargaze-rpc.ibs.team"
    ],
    cosmosDirectoryId: "stargaze",
    connectionString: process.env.StargazeDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/public-awesome/mainnet/main/stargaze-1/genesis.tar.gz",
    coinGeckoId: "stargaze",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/stargaze/images/stars.png",
    logoUrlPNG: "https://console.akash.network/images/chains/stars.png",
    customIndexers: [],
    bech32Prefix: "stars",
    denom: "stars",
    udenom: "ustars",
    startHeight: 9_401_277
  },
  secret: {
    code: "secret",
    rpcNodes: [
      "https://rpc.secret.forbole.com/",
      "https://scrt-rpc.agoranodes.com",
      "https://secretnetwork-rpc.stakely.io",
      "https://rpc-secret.whispernode.com"
    ],
    cosmosDirectoryId: "secretnetwork",
    connectionString: process.env.SecretDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/enigmampc/SecretNetwork/master/secret-testnet-genesis.json",
    coinGeckoId: "secret",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/secretnetwork/images/scrt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/scrt.png",
    customIndexers: [],
    bech32Prefix: "secret",
    denom: "scrt",
    udenom: "uscrt",
    startHeight: 10_024_705
  },
  evmos: {
    code: "evmos",
    rpcNodes: [
      "https://rpc.evmos.tcnetwork.io",
      "https://tendermint.bd.evmos.org:26657",
      "https://rpc.evmos.bh.rocks",
      "https://rpc-evmos.ecostake.com",
      "https://rpc.evmos.interbloc.org",
      "https://rpc.evmos.nodestake.top",
      "https://rpc-evmos.goldenratiostaking.net",
      "https://rpc-evmos-ia.cosmosia.notional.ventures:443",
      "https://rpc.evmos.silentvalidator.com/",
      "https://evmos.rpc.stakin-nodes.com",
      "https://rpc-evmos.architectnodes.com",
      "https://rpc.evmos.chaintools.tech/",
      "https://evmos-rpc.lavenderfive.com:443",
      "https://rpc.evmos.silknodes.io/"
    ],
    cosmosDirectoryId: "evmos",
    connectionString: process.env.EvmosDatabaseCS,
    genesisFileUrl: "https://archive.evmos.org/mainnet/genesis.json",
    coinGeckoId: "evmos",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/evmos/images/evmos.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/evmos.png",
    customIndexers: [],
    bech32Prefix: "evmos",
    denom: "evmos",
    udenom: "uevmos",
    startHeight: 14_993_969
  },
  huahua: {
    code: "huahua",
    rpcNodes: [
      "https://rpc-chihuahua-ia.cosmosia.notional.ventures/",
      "https://rpc-chihuahua.ecostake.com",
      "https://rpc.chihuahua.wtf/",
      "https://rpc.huahua.bh.rocks",
      "https://chihuahua-rpc.polkachu.com",
      "https://chihuahua-rpc.kleomedes.network",
      "https://rpc-chihuahua.pupmos.network/"
    ],
    cosmosDirectoryId: "chihuahua",
    connectionString: process.env.HuahuaDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/ChihuahuaChain/chihuahua/main/mainnet/genesis.json",
    coinGeckoId: "chihuahua-chain",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/chihuahua/images/huahua.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/huahua.png",
    customIndexers: [],
    bech32Prefix: "chihuahua",
    denom: "HUAHUA",
    udenom: "uhuahua",
    startHeight: 8_612_168
  },
  stride: {
    code: "stride",
    rpcNodes: [
      "https://stride.nodejumper.io:443",
      "http://rpc-stride.nodeist.net",
      "https://stride.rpc.kjnodes.com",
      "https://rpc.stride.bh.rocks",
      "https://stride-rpc.lavenderfive.com/",
      "https://rpc.stride.silentvalidator.com/",
      "https://stride-rpc.polkachu.com/",
      "https://rpc-stride.pupmos.network",
      "https://rpc-stride.architectnodes.com",
      "https://stride.rpc.chandrastation.com",
      "https://stride.rpc.interchain.ivaldilabs.xyz"
    ],
    cosmosDirectoryId: "stride",
    connectionString: process.env.StrideDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/Stride-Labs/testnet/main/mainnet/genesis.json",
    coinGeckoId: "stride",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/stride/images/strd.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/strd.png",
    customIndexers: [],
    bech32Prefix: "stride",
    denom: "STRD",
    udenom: "ustrd",
    startHeight: 4_823_860
  },
  kujira: {
    code: "kujira",
    rpcNodes: [
      "https://rpc-kujira.ecostake.com",
      "https://rpc-kujira.nodeist.net",
      "https://rpc-kujira.starsquid.io",
      "https://rpc-kujira-ia.cosmosia.notional.ventures/",
      "https://rpc.kujira.chaintools.tech/",
      "https://kujira-rpc.ibs.team/",
      "https://kujira.rpc.kjnodes.com",
      "https://kuji-rpc.kleomedes.network",
      "https://kujira-rpc.polkachu.com",
      "https://kujira-rpc.wildsage.io",
      // "https://rpc.kaiyo.kujira.setten.io",
      "https://kujira-rpc.lavenderfive.com:443",
      "https://rpc-kujira.whispernode.com"
    ],
    cosmosDirectoryId: "kujira",
    connectionString: process.env.KujiraDatabaseCS,
    genesisFileUrl: "https://raw.githubusercontent.com/Team-Kujira/networks/master/mainnet/kaiyo-1.json",
    coinGeckoId: "kujira",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/kujira/images/kuji.png",
    logoUrlPNG: "https://console.akash.network/images/chains/kuji.png",
    customIndexers: [],
    bech32Prefix: "kujira",
    denom: "KUJI",
    udenom: "ukuji",
    startHeight: 12_975_265
  }
};

export const activeChain = chainDefinitions[process.env.ActiveChain || "akash"];
