import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/chain-sdk/web";
import { netConfig } from "@akashnetwork/net";

import type { Network } from "./network.type";

export interface AkashSandboxNetworkOverride {
  chainId: string;
  genesisUrl: string;
  restApiUrl: string;
  rpcUrl: string;
}

interface AkashSandboxNetworkOverrideInput {
  chainId?: string;
  genesisUrl?: string;
  restApiUrl?: string;
  rpcUrl?: string;
}

const AKASH_SANDBOX_OVERRIDE_ENV_NAMES = [
  "NEXT_PUBLIC_AKASH_SANDBOX_CHAIN_ID",
  "NEXT_PUBLIC_AKASH_SANDBOX_RPC_URL",
  "NEXT_PUBLIC_AKASH_SANDBOX_REST_API_URL",
  "NEXT_PUBLIC_AKASH_SANDBOX_GENESIS_URL"
] as const;

export function resolveAkashSandboxNetworkOverride(input: AkashSandboxNetworkOverrideInput): AkashSandboxNetworkOverride | undefined {
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

export function getAkashSandboxNetworkOverrideFromEnv(): AkashSandboxNetworkOverride | undefined {
  return resolveAkashSandboxNetworkOverride({
    chainId: process.env.NEXT_PUBLIC_AKASH_SANDBOX_CHAIN_ID,
    rpcUrl: process.env.NEXT_PUBLIC_AKASH_SANDBOX_RPC_URL,
    restApiUrl: process.env.NEXT_PUBLIC_AKASH_SANDBOX_REST_API_URL,
    genesisUrl: process.env.NEXT_PUBLIC_AKASH_SANDBOX_GENESIS_URL
  });
}

export const getInitialNetworksConfig = ({
  apiBaseUrl,
  akashSandboxOverride = getAkashSandboxNetworkOverrideFromEnv()
}: {
  apiBaseUrl: string;
  akashSandboxOverride?: AkashSandboxNetworkOverride;
}): Network[] => [
  {
    id: MAINNET_ID,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    nodesUrl: `${apiBaseUrl}/blockchain-config?network=mainnet`,
    chainId: "akashnet-2",
    chainRegistryName: "akash",
    rpcEndpoint: netConfig.getBaseRpcUrl(MAINNET_ID),
    enabled: true,
    deploymentVersion: "v1beta4",
    marketVersion: "v1beta5",
    escrowVersion: "v1",
    certVersion: "v1",
    providerVersion: "v1beta4",
    version: netConfig.getVersion(MAINNET_ID)
  },
  {
    id: SANDBOX_ID,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    nodesUrl: `${apiBaseUrl}/blockchain-config?network=sandbox`,
    chainId: akashSandboxOverride?.chainId ?? "sandbox-2",
    chainRegistryName: "akash-sandbox",
    rpcEndpoint: akashSandboxOverride?.rpcUrl ?? netConfig.getBaseRpcUrl(SANDBOX_ID),
    version: netConfig.getVersion(SANDBOX_ID),
    enabled: true,
    deploymentVersion: "v1beta4",
    marketVersion: "v1beta5",
    escrowVersion: "v1",
    certVersion: "v1",
    providerVersion: "v1beta4"
  },
  {
    id: TESTNET_ID,
    title: "Testnet",
    description: "Testnet of the BME feature.",
    nodesUrl: `${apiBaseUrl}/blockchain-config?network=testnet`,
    chainId: "testnet-8",
    chainRegistryName: "akash-testnet",
    rpcEndpoint: "",
    enabled: false,
    deploymentVersion: "v1beta4",
    marketVersion: "v1beta5",
    escrowVersion: "v1",
    certVersion: "v1",
    providerVersion: "v1beta4",
    version: null
  }
];

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
