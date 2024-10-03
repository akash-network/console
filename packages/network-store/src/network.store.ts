import axios from "axios";
import { atom } from "jotai";
import { getDefaultStore, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { INITIAL_NETWORKS_CONFIG } from "./network.config";
import type { Network } from "./network.type";

interface NetworkStoreOptions {
  defaultNetworkId: Network["id"];
  apiBaseUrl: string;
  store?: ReturnType<typeof getDefaultStore>;
}

interface NetworksStore {
  isLoading: boolean;
  error?: Error;
  data: Network[];
}

class NetworkStoreVersionsInitError extends Error {
  errors: Error[];
  constructor(errors: { network: Network; error: Error }[]) {
    super(`Failed to fetch network versions: ${errors.map(({ network }) => network.id).join(", ")}`);
    this.errors = errors.map(({ error }) => error);
  }
}

export class NetworkStore {
  static create(options: NetworkStoreOptions) {
    return new NetworkStore(options);
  }

  readonly networksStore = atom<NetworksStore>({ isLoading: true, error: undefined, data: INITIAL_NETWORKS_CONFIG });

  private readonly selectedNetworkIdStore = atomWithStorage<Network["id"]>("selectedNetworkId", this.options.defaultNetworkId, undefined, { getOnInit: true });

  private readonly selectedNetworkStore = atom<Network, [Network], void>(
    get => {
      const networkId = get(this.selectedNetworkIdStore);
      const networks = get(this.networksStore).data;

      return networks.find(n => n.id === networkId) ?? networks[0];
    },
    async (get, set, next) => {
      await set(this.selectedNetworkIdStore, next.id);
    }
  );

  private readonly store: ReturnType<typeof getDefaultStore>;

  get networks() {
    return this.store.get(this.networksStore).data;
  }

  get selectedNetwork() {
    return this.store.get(this.selectedNetworkStore);
  }

  get selectedNetworkId() {
    return this.store.get(this.selectedNetworkIdStore);
  }

  get apiVersion() {
    return this.selectedNetwork.apiVersion;
  }

  get marketApiVersion() {
    return this.selectedNetwork.marketApiVersion;
  }

  constructor(private readonly options: NetworkStoreOptions) {
    this.store = options.store || getDefaultStore();
    this.initiateNetworks();
  }

  private async initiateNetworks() {
    const errors: { network: Network; error: Error }[] = [];
    const networks = await Promise.all(
      INITIAL_NETWORKS_CONFIG.map(async network => {
        try {
          network.versionUrl = this.options.apiBaseUrl + network.versionUrl;
          network.nodesUrl = this.options.apiBaseUrl + network.nodesUrl;

          const response = await axios.get<string>(network.versionUrl, { timeout: 10000 });
          network.version = response.data;

          return network;
        } catch (error) {
          errors.push({ network, error });

          return network;
        }
      })
    );

    if (errors.length > 0) {
      this.store.set(this.networksStore, { data: this.networks, isLoading: false, error: new NetworkStoreVersionsInitError(errors) });
    } else {
      this.store.set(this.networksStore, { data: networks, isLoading: false, error: undefined });
    }
  }

  useNetworksStore() {
    return useAtom(this.networksStore);
  }

  useNetworks() {
    return this.useNetworksStore()[0].data;
  }

  useSelectedNetworkStore() {
    return useAtom(this.selectedNetworkStore);
  }

  useSelectedNetwork() {
    return this.useSelectedNetworkStore()[0];
  }

  useSelectedNetworkIdStore({ reloadOnChange } = { reloadOnChange: false }): [Network["id"], (networkId: Network["id"]) => void] {
    const [networkId, setNetworkId] = useAtom(this.selectedNetworkIdStore);

    if (reloadOnChange) {
      return [
        networkId,
        (networkId: Network["id"]) => {
          setNetworkId(networkId);
          location.reload();
        }
      ];
    } else {
      return [networkId, setNetworkId];
    }
  }

  useSelectedNetworkId() {
    return this.useSelectedNetworkIdStore()[0];
  }
}
