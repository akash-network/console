import type { MainnetNetworkId, SandboxNetworkId, TestnetNetworkId } from "@akashnetwork/akashjs/build/types/network";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { Network } from "@src/types/network";

export const MAINNET_ID: MainnetNetworkId = "mainnet";
export const SANDBOX_ID: SandboxNetworkId = "sandbox";
export const TESTNET_ID: TestnetNetworkId = "testnet";

export const INITIAL_NETWORKS_CONFIG: Network[] = [
  {
    id: MAINNET_ID,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    nodesUrl: `${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/v1/nodes/mainnet`,
    chainId: "akashnet-2",
    chainRegistryName: "akash",
    versionUrl: `${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/v1/version/mainnet`,
    rpcEndpoint: "https://rpc.cosmos.directory/akash",
    enabled: true,
    apiVersion: "v1beta3",
    marketApiVersion: "v1beta4",
    version: null
  },
  {
    id: TESTNET_ID,
    title: "GPU Testnet",
    description: "Testnet of the new GPU features.",
    nodesUrl: `${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/v1/nodes/testnet`,
    chainId: "testnet-02",
    chainRegistryName: "akash-testnet",
    versionUrl: `${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/v1/version/testnet`,
    rpcEndpoint: "https://rpc.testnet-02.aksh.pw:443",
    enabled: false,
    apiVersion: "v1beta3",
    marketApiVersion: "v1beta3",
    version: null
  },
  {
    id: SANDBOX_ID,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    nodesUrl: `${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/v1/nodes/sandbox`,
    chainId: "sandbox-01",
    chainRegistryName: "akash-sandbox",
    versionUrl: `${browserEnvConfig.NEXT_PUBLIC_API_BASE_URL}/v1/version/sandbox`,
    rpcEndpoint: "https://rpc.sandbox-01.aksh.pw:443",
    version: null,
    enabled: true,
    apiVersion: "v1beta3",
    marketApiVersion: "v1beta4"
  }
];
