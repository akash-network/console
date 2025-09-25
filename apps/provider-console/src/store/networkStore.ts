import axios from "axios";
import { atom } from "jotai";

import type { NetworkConfig } from "@src/config/network.config";
import { getCurrentNetworkConfig } from "@src/config/network.config";
import type { Network } from "@src/types/network";

/**
 * Converts NetworkConfig to Network by properly mapping the fields
 * This ensures type safety and handles the structural differences between the types
 */
function buildNetworkFromConfig(config: NetworkConfig): Network {
  return {
    id: config.id,
    title: config.title,
    description: config.description,
    nodesUrl: config.nodesUrl,
    chainId: config.chainId,
    chainRegistryName: config.chainRegistryName,
    versionUrl: config.versionUrl,
    rpcEndpoint: config.rpcEndpoint, // NetworkConfig has required rpcEndpoint, Network has optional
    version: config.version,
    enabled: config.enabled
  };
}

// Get the current network configuration from environment
const currentNetworkConfig = getCurrentNetworkConfig();

export let networks: Network[] = [buildNetworkFromConfig(currentNetworkConfig)];

/**
 * Get the actual versions and metadata of the available networks
 */
export const initiateNetworkData = async () => {
  networks = await Promise.all(
    networks.map(async network => {
      let version = null;
      try {
        const response = await axios.get(network.versionUrl, { timeout: 10000 });
        version = response.data;
      } catch (error) {
        console.log(error);
      }

      return {
        ...network,
        version
      };
    })
  );
};

const selectedNetwork = atom<Network>(networks[0]);

const networkStore = {
  selectedNetwork
};

export default networkStore;
