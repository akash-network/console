import type { Chain } from "@chain-registry/types";

import { akash } from "@src/chains/akash";
import type { Network } from "@src/types/network";
import { browserEnvConfig } from "./browser-env.config";

/**
 * Gets the current network configuration based on the selected network
 * No if/else conditions - GitHub Actions sets the selection variable
 */
export function getCurrentNetworkConfig(): Network {
  const selectedNetwork = browserEnvConfig.NEXT_PUBLIC_SELECTED_NETWORK ?? "mainnet";

  // Get the configuration for the selected network
  const config = getNetworkConfig();

  return {
    id: selectedNetwork,
    title: config.title,
    description: `Akash Network ${config.title.toLowerCase()} network.`,
    chainId: config.chainId,
    chainRegistryName: config.chainRegistryName,
    enabled: true,
    version: config.version || null,
    rpcEndpoint: config.rpcEndpoint,
    nodesUrl: config.apiEndpoint,
    versionUrl: config.apiEndpoint
  };
}

/**
 * Gets network configuration from environment variables
 * Values are populated from chain-specific .env files based on NETWORK variable
 */
function getNetworkConfig() {
  return {
    title: browserEnvConfig.NEXT_PUBLIC_NETWORK_TITLE,
    chainId: browserEnvConfig.NEXT_PUBLIC_CHAIN_ID,
    chainRegistryName: browserEnvConfig.NEXT_PUBLIC_CHAIN_REGISTRY_NAME,
    networkType: browserEnvConfig.NEXT_PUBLIC_NETWORK_TYPE,
    rpcEndpoint: browserEnvConfig.NEXT_PUBLIC_RPC_ENDPOINT,
    apiEndpoint: browserEnvConfig.NEXT_PUBLIC_API_ENDPOINT,
    version: browserEnvConfig.NEXT_PUBLIC_NETWORK_VERSION,
    versionMarket: browserEnvConfig.NEXT_PUBLIC_NETWORK_VERSION_MARKET,
    consoleApiUrl: browserEnvConfig.NEXT_PUBLIC_CONSOLE_API_URL,
    securityUrl: browserEnvConfig.NEXT_PUBLIC_SECURITY_URL,
    apiBaseUrl: browserEnvConfig.NEXT_PUBLIC_API_BASE_URL
  };
}

/**
 * Creates a dynamic Chain object by extending the base akash chain
 * Following the same pattern as akashSandbox but environment-driven
 * Only overrides network-specific properties from environment variables
 */
export function createDynamicChain(): Chain {
  const config = getNetworkConfig();

  return {
    ...akash, // Extend the full akash chain with all comprehensive information
    chain_id: config.chainId,
    network_type: config.networkType as "mainnet" | "testnet" | "devnet",
    chain_name: config.chainRegistryName,
    pretty_name: config.title,
    apis: {
      rpc: [{ address: config.rpcEndpoint, provider: "custom" }],
      rest: [{ address: config.apiEndpoint, provider: "custom" }]
    }
  };
}

/**
 * Gets network version information based on the selected network
 * No if/else conditions - GitHub Actions sets the selection variable
 */
export function getNetworkVersionInfo() {
  const selectedNetwork = browserEnvConfig.NEXT_PUBLIC_SELECTED_NETWORK ?? "mainnet";
  const config = getNetworkConfig();

  return {
    networkVersion: (config.version || "v1beta3") as "v1beta2" | "v1beta3" | "v1beta4",
    networkVersionMarket: (config.versionMarket || "v1beta4") as "v1beta2" | "v1beta3" | "v1beta4",
    selectedNetworkId: selectedNetwork
  };
}
