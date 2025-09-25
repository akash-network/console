import type { MainnetNetworkId, SandboxNetworkId, TestnetNetworkId } from "@akashnetwork/akashjs/build/types/network";
import { netConfig } from "@akashnetwork/net";

import type { Network } from "./network.type";

export const MAINNET_ID: MainnetNetworkId = "mainnet";
export const SANDBOX_ID: SandboxNetworkId = "sandbox";
export const TESTNET_ID: TestnetNetworkId = "testnet";

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
    apiVersion: "v1beta3",
    marketApiVersion: "v1beta4",
    version: netConfig.getVersion(MAINNET_ID)
  },
  {
    id: TESTNET_ID,
    title: "GPU Testnet",
    description: "Testnet of the new GPU features.",
    nodesUrl: `${apiBaseUrl}/v1/nodes/testnet`,
    chainId: "testnet-02",
    chainRegistryName: "akash-testnet",
    versionUrl: `${apiBaseUrl}/v1/version/testnet`,
    rpcEndpoint: netConfig.getBaseRpcUrl("testnet-02"),
    enabled: false,
    apiVersion: "v1beta3",
    marketApiVersion: "v1beta3",
    version: netConfig.getVersion("testnet-02")
  },
  {
    id: SANDBOX_ID,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    nodesUrl: `${apiBaseUrl}/v1/nodes/sandbox`,
    chainId: "sandbox-01",
    chainRegistryName: "akash-sandbox",
    versionUrl: `${apiBaseUrl}/v1/version/sandbox`,
    rpcEndpoint: netConfig.getBaseRpcUrl(SANDBOX_ID),
    version: netConfig.getVersion(SANDBOX_ID),
    enabled: true,
    apiVersion: "v1beta3",
    marketApiVersion: "v1beta4"
  }
];
