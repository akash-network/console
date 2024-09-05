import axios from "axios";
import { atom } from "jotai";
import { useAtom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { MAINNET_ID, SANDBOX_ID, TESTNET_ID } from "@src/config/network.config";
import { store } from "@src/store/global-store";
import { Network } from "@src/types/network";
import { ApiUrlService, mainnetNodes, sandboxNodes, testnetNodes } from "@src/utils/apiUtils";

export let networks: Network[] = [
  {
    id: MAINNET_ID,
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
    id: TESTNET_ID,
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
    id: SANDBOX_ID,
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

const selectedNetworkId = atomWithStorage<Network["id"]>(
  "selectedNetworkId",
  browserEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID,
  // TODO: remove this once we have all clients using this store instead of the localstorage
  //   Issue: https://github.com/akash-network/console/issues/297
  typeof window !== "undefined"
    ? {
        setItem: (key, value) => {
          localStorage.setItem(key, value);
          location.reload();
        },
        getItem: key => {
          const stored = localStorage.getItem(key) as Network["id"] | null;

          if (!stored) {
            localStorage.setItem(key, browserEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID);
            return browserEnvConfig.NEXT_PUBLIC_DEFAULT_NETWORK_ID;
          }

          return stored;
        },
        removeItem: key => {
          localStorage.removeItem(key);
          location.reload();
        }
      }
    : undefined,
  { getOnInit: true }
);
const selectedNetwork = atom<Network, [Network], void>(
  get => {
    const networkId = get(selectedNetworkId);
    return networks.find(n => n.id === networkId) ?? networks[0];
  },
  (get, set, next) => {
    set(selectedNetworkId, next.id);
  }
);

export default {
  selectedNetworkId,
  selectedNetwork,
  getSelectedNetwork: () => store.get(selectedNetwork),
  useSelectedNetwork: () => useAtom(selectedNetwork)[0]
};
