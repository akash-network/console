import axios from "axios";
import { atom } from "jotai";
import { useAtom } from "jotai/index";
import { atomWithStorage } from "jotai/utils";
import cloneDeep from "lodash/cloneDeep";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { INITIAL_NETWORKS_CONFIG } from "@src/config/network.config";
import { store } from "@src/store/global-store";
import type { Network } from "@src/types/network";

export const networks: Network[] = cloneDeep(INITIAL_NETWORKS_CONFIG);

export const initiateNetworkVersions = async () => {
  await Promise.all(
    networks.map(async network => {
      try {
        const response = await axios.get<string>(network.versionUrl, { timeout: 10000 });
        network.version = response.data;
        return;
      } catch (error) {
        console.error(error);
      }
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
  getSelectedNetworkId: () => store.get(selectedNetwork).id,
  useSelectedNetwork: () => useAtom(selectedNetwork)[0],
  get apiVersion() {
    return store.get(selectedNetwork).apiVersion;
  },
  get marketApiVersion() {
    return store.get(selectedNetwork).marketApiVersion;
  }
};
