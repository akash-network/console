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
  ProviderMaintenance,
  ProviderSnapshot,
  ProviderSnapshotNode,
  ProviderSnapshotNodeCPU,
  ProviderSnapshotNodeGPU,
  ProviderSnapshotStorage,
  VerificationAttestation,
  VerificationAttestationCapability,
  VerificationAuditEscrow,
  VerificationAuditEscrowCapability,
  VerificationAuditor,
  VerificationBlockEvent,
  VerificationDiscrepancy,
  VerificationGrace,
  VerificationGraceDiscrepancy,
  VerificationParams,
  VerificationProviderBond,
  VerificationProviderBondUnbonding,
  VerificationProviderObservation,
  VerificationProviderSnapshot,
  VerificationProviderTierDemotion,
  VerificationProviderTierStream,
  VerificationReconcileTarget
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
  chainId: string;
  code: string;
  rpcNodes: string[];
  apiUrl: string;
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

interface AkashSandboxChainOverrideInput {
  chainId?: string;
  genesisUrl?: string;
  restApiUrl?: string;
  rpcUrl?: string;
}

export interface AkashSandboxChainOverride {
  chainId: string;
  genesisUrl: string;
  restApiUrl: string;
  rpcUrl: string;
}

const AKASH_SANDBOX_OVERRIDE_ENV_NAMES = [
  "NEXT_PUBLIC_AKASH_SANDBOX_CHAIN_ID",
  "NEXT_PUBLIC_AKASH_SANDBOX_RPC_URL",
  "NEXT_PUBLIC_AKASH_SANDBOX_REST_API_URL",
  "NEXT_PUBLIC_AKASH_SANDBOX_GENESIS_URL"
] as const;

export function resolveAkashSandboxChainOverride(input: AkashSandboxChainOverrideInput): AkashSandboxChainOverride | undefined {
  const configuredValues = Object.values(input).filter(value => Boolean(value?.trim()));
  if (configuredValues.length === 0) return undefined;
  if (configuredValues.length !== AKASH_SANDBOX_OVERRIDE_ENV_NAMES.length) {
    throw new Error(`${AKASH_SANDBOX_OVERRIDE_ENV_NAMES.join(", ")} must be set together`);
  }

  return {
    chainId: requireValue(input.chainId, AKASH_SANDBOX_OVERRIDE_ENV_NAMES[0]),
    rpcUrl: requireHttpUrl(input.rpcUrl, AKASH_SANDBOX_OVERRIDE_ENV_NAMES[1]),
    restApiUrl: requireHttpUrl(input.restApiUrl, AKASH_SANDBOX_OVERRIDE_ENV_NAMES[2]),
    genesisUrl: requireHttpUrl(input.genesisUrl, AKASH_SANDBOX_OVERRIDE_ENV_NAMES[3])
  };
}

const akashSandboxOverride = resolveAkashSandboxChainOverride({
  chainId: process.env.NEXT_PUBLIC_AKASH_SANDBOX_CHAIN_ID,
  rpcUrl: process.env.NEXT_PUBLIC_AKASH_SANDBOX_RPC_URL,
  restApiUrl: process.env.NEXT_PUBLIC_AKASH_SANDBOX_REST_API_URL,
  genesisUrl: process.env.NEXT_PUBLIC_AKASH_SANDBOX_GENESIS_URL
});

export const chainDefinitions: { [key: string]: ChainDef } = {
  akash: {
    chainId: "akashnet-2",
    code: "akash",
    rpcNodes: netConfig.getAllBaseRpcUrls("mainnet"),
    apiUrl: netConfig.getBaseAPIUrl("mainnet"),
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_DATABASE_CS,
    genesisFileUrl: `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("mainnet")}/genesis.json`,
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer", "BmeIndexer", "ProviderVerificationIndexer"],
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
      ProviderMaintenance,
      ProviderSnapshot,
      ProviderSnapshotNode,
      ProviderSnapshotNodeCPU,
      ProviderSnapshotNodeGPU,
      ProviderSnapshotStorage,
      BmeLedgerRecord,
      BmeRawEvent,
      BmeStatusChange,
      VerificationAttestation,
      VerificationAttestationCapability,
      VerificationAuditEscrow,
      VerificationAuditEscrowCapability,
      VerificationAuditor,
      VerificationBlockEvent,
      VerificationDiscrepancy,
      VerificationGrace,
      VerificationGraceDiscrepancy,
      VerificationParams,
      VerificationProviderBond,
      VerificationProviderBondUnbonding,
      VerificationProviderObservation,
      VerificationProviderSnapshot,
      VerificationProviderTierDemotion,
      VerificationProviderTierStream,
      VerificationReconcileTarget
    ]
  },
  get akashTestnet() {
    return {
      chainId: "testnet-8",
      code: "akash-testnet",
      rpcNodes: netConfig.getAllBaseRpcUrls("testnet"),
      apiUrl: netConfig.getBaseAPIUrl("testnet"),
      cosmosDirectoryId: "akash",
      connectionString: process.env.AKASH_TESTNET_DATABASE_CS,
      genesisFileUrl: `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("testnet")}/genesis.json`,
      coinGeckoId: "akash-network",
      logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
      logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
      customIndexers: ["AkashStatsIndexer", "BmeIndexer", "ProviderVerificationIndexer"],
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
        ProviderMaintenance,
        ProviderSnapshot,
        ProviderSnapshotNode,
        ProviderSnapshotNodeCPU,
        ProviderSnapshotNodeGPU,
        ProviderSnapshotStorage,
        BmeLedgerRecord,
        BmeRawEvent,
        BmeStatusChange,
        VerificationAttestation,
        VerificationAttestationCapability,
        VerificationAuditEscrow,
        VerificationAuditEscrowCapability,
        VerificationAuditor,
        VerificationBlockEvent,
        VerificationDiscrepancy,
        VerificationGrace,
        VerificationGraceDiscrepancy,
        VerificationParams,
        VerificationProviderBond,
        VerificationProviderBondUnbonding,
        VerificationProviderObservation,
        VerificationProviderSnapshot,
        VerificationProviderTierDemotion,
        VerificationProviderTierStream,
        VerificationReconcileTarget
      ]
    };
  },
  akashSandbox: {
    chainId: akashSandboxOverride?.chainId ?? "sandbox-2",
    code: "akash-sandbox",
    rpcNodes: akashSandboxOverride ? [akashSandboxOverride.rpcUrl] : netConfig.getAllBaseRpcUrls("sandbox"),
    apiUrl: akashSandboxOverride?.restApiUrl ?? netConfig.getBaseAPIUrl("sandbox"),
    cosmosDirectoryId: "akash",
    connectionString: process.env.AKASH_SANDBOX_DATABASE_CS,
    genesisFileUrl: akashSandboxOverride?.genesisUrl ?? `https://raw.githubusercontent.com/akash-network/net/main/${netConfig.mapped("sandbox")}/genesis.json`,
    coinGeckoId: "akash-network",
    logoUrlSVG: "https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.svg",
    logoUrlPNG: "https://console.akash.network/images/chains/akash.png",
    customIndexers: ["AkashStatsIndexer", "BmeIndexer", "ProviderVerificationIndexer"],
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
      ProviderMaintenance,
      ProviderSnapshot,
      ProviderSnapshotNode,
      ProviderSnapshotNodeCPU,
      ProviderSnapshotNodeGPU,
      ProviderSnapshotStorage,
      BmeLedgerRecord,
      BmeRawEvent,
      BmeStatusChange,
      VerificationAttestation,
      VerificationAttestationCapability,
      VerificationAuditEscrow,
      VerificationAuditEscrowCapability,
      VerificationAuditor,
      VerificationBlockEvent,
      VerificationDiscrepancy,
      VerificationGrace,
      VerificationGraceDiscrepancy,
      VerificationParams,
      VerificationProviderBond,
      VerificationProviderBondUnbonding,
      VerificationProviderObservation,
      VerificationProviderSnapshot,
      VerificationProviderTierDemotion,
      VerificationProviderTierStream,
      VerificationReconcileTarget
    ]
  }
};

export const activeChain = chainDefinitions[process.env.ACTIVE_CHAIN || "akash"];

function requireValue(value: string | undefined, name: string): string {
  const trimmedValue = value?.trim();
  if (!trimmedValue) throw new Error(`${name} must not be empty`);
  return trimmedValue;
}

function requireHttpUrl(value: string | undefined, name: string): string {
  const url = requireValue(value, name);
  const protocol = new URL(url).protocol;
  if (protocol !== "http:" && protocol !== "https:") throw new Error(`${name} must use http or https`);
  return url;
}
