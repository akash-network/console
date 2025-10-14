import { netConfig, type SupportedChainNetworks } from "@akashnetwork/net";

import type { Network } from "./network.type";

export const MAINNET_ID: SupportedChainNetworks = "mainnet";
export const SANDBOX_ID: SupportedChainNetworks = "sandbox-2";
export const TESTNET_ID: SupportedChainNetworks = "testnet-7";

export const getInitialNetworksConfig = ({ apiBaseUrl }: { apiBaseUrl: string }): Network[] => [
  {
    id: MAINNET_ID,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    nodesUrl: `${apiBaseUrl}/v1/nodes/mainnet`,
    chainId: "akashnet-2",
    chainRegistryName: "akash",
    versionUrl: `${apiBaseUrl}/v1/version/mainnet`,
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
    id: TESTNET_ID,
    title: "SDK53 Testnet",
    description: "Testnet of the new SDK features.",
    nodesUrl: `${apiBaseUrl}/v1/nodes/testnet`,
    chainId: "testnet-7",
    chainRegistryName: "akash-testnet",
    versionUrl: `${apiBaseUrl}/v1/version/testnet`,
    rpcEndpoint: netConfig.getBaseRpcUrl("testnet-7"),
    enabled: true,
    deploymentVersion: "v1beta4",
    marketVersion: "v1beta5",
    escrowVersion: "v1",
    certVersion: "v1",
    providerVersion: "v1beta4",
    version: netConfig.getVersion("testnet-7")
  },
  {
    id: SANDBOX_ID,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    nodesUrl: `${apiBaseUrl}/v1/nodes/sandbox`,
    chainId: "sandbox-2",
    chainRegistryName: "akash-sandbox",
    versionUrl: `${apiBaseUrl}/v1/version/sandbox`,
    rpcEndpoint: netConfig.getBaseRpcUrl(SANDBOX_ID),
    version: netConfig.getVersion(SANDBOX_ID),
    enabled: true,
    deploymentVersion: "v1beta4",
    marketVersion: "v1beta5",
    escrowVersion: "v1",
    certVersion: "v1",
    providerVersion: "v1beta4"
  }
];
