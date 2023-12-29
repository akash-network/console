// import { Network } from "@src/types/network";
// import { ApiUrlService } from "@src/utils/apiUtils";
import { ApiUrlService } from "@/lib/apiUtils";
import { mainnetId, sandboxId, testnetId } from "@/lib/constants";
import { Network } from "@/types/network";
import axios from "axios";
import { atom } from "jotai";

export let networks: Network[] = [
  {
    id: mainnetId,
    title: "Mainnet",
    description: "Akash Network mainnet network.",
    chainId: "akashnet-2",
    versionUrl: ApiUrlService.mainnetVersion(),
    rpcEndpoint: "https://rpc.cosmos.directory/akash",
    enabled: true,
    version: null // Set asynchronously
  },
  {
    id: testnetId,
    title: "GPU Testnet",
    description: "Testnet of the new GPU features.",
    chainId: "testnet-02",
    versionUrl: ApiUrlService.testnetVersion(),
    enabled: false,
    version: null // Set asynchronously
  },
  {
    id: sandboxId,
    title: "Sandbox",
    description: "Sandbox of the mainnet version.",
    chainId: "sandbox-01",
    versionUrl: ApiUrlService.sandboxVersion(),
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
