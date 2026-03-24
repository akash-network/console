import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@akashnetwork/chain-sdk/web";
import { netConfig } from "@akashnetwork/net";

import type { Network } from "./network.type";

export const getInitialNetworksConfig = ({ apiBaseUrl }: { apiBaseUrl: string }): Network[] => [
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
    chainId: "sandbox-2",
    chainRegistryName: "akash-sandbox",
    rpcEndpoint: netConfig.getBaseRpcUrl(SANDBOX_ID),
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
