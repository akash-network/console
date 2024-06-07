import axios from "axios";
import { atom } from "jotai";

import { Network } from "@src/types/network";
import { ApiUrlService, mainnetNodes, sandboxNodes, testnetNodes } from "@src/utils/apiUtils";
import { mainnetId, sandboxId, testnetId } from "@src/utils/constants";

export let networks: Network[] = [
  {
    id: mainnetId,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    nodesUrl: mainnetNodes,
    chainId: "akashnet-2",
    chainRegistryName: "akash",
    versionUrl: ApiUrlService.mainnetVersion(),
    rpcEndpoint: "https://rpc.cosmos.directory/akash",
    enabled: true,
    version: null // Set asynchronously
  },
  {
    id: testnetId,
    title: "GPU Testnet",
    description: "Testnet of the new GPU features.",
    nodesUrl: testnetNodes,
    chainId: "testnet-02",
    chainRegistryName: "akash-testnet",
    versionUrl: ApiUrlService.testnetVersion(),
    rpcEndpoint: "https://rpc.testnet-02.aksh.pw:443",
    enabled: false,
    version: null // Set asynchronously
  },
  {
    id: sandboxId,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    nodesUrl: sandboxNodes,
    chainId: "sandbox-01",
    chainRegistryName: "akash-sandbox",
    versionUrl: ApiUrlService.sandboxVersion(),
    rpcEndpoint: "https://rpc.sandbox-01.aksh.pw:443",
    version: null, // Set asynchronously
    enabled: true
  }
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

export default {
  selectedNetwork
};
