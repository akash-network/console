import { LoggerService } from "@akashnetwork/logging";
import axios from "axios";
import { atom } from "jotai";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { Network } from "@src/types/network";
import { mainnetId, } from "@src/utils/constants";

const logger = LoggerService.forContext("apps/provider-console/src/store/networkStore.ts");

export let networks: Network[] = [
  {
    id: mainnetId,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    chainId: "akashnet-2",
    chainRegistryName: "akash",
    enabled: true,
    version: null,
    rpcEndpoint: browserEnvConfig.NEXT_PUBLIC_MAINNET_RPC_URL,
    nodesUrl: browserEnvConfig.NEXT_PUBLIC_MAINNET_API_URL,
    versionUrl: browserEnvConfig.NEXT_PUBLIC_MAINNET_API_URL
  },
];

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
        logger.debug(error);
      }

      return {
        ...network,
        version
      };
    })
  );
};

const selectedNetwork = atom<Network>(networks[0]);

export default {
  selectedNetwork
};
