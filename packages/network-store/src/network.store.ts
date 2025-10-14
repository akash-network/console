import { atom } from "jotai";
import { getDefaultStore, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { getInitialNetworksConfig } from "./network.config";
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

export class NetworkStore {
  static create(options: NetworkStoreOptions) {
    return new NetworkStore(options);
  }

  private readonly STORAGE_KEY = "selectedNetworkId";

  private readonly allNetworks: Network[];
  readonly networksStore = atom<NetworksStore>({ isLoading: true, error: undefined, data: [] });

  private readonly selectedNetworkIdStore = atomWithStorage<Network["id"]>(this.STORAGE_KEY, this.options.defaultNetworkId, undefined, {
    getOnInit: true
  });

  private readonly selectedNetworkStore = atom<Network, [Network], void>(
    get => {
      const networkId = get(this.selectedNetworkIdStore);
      const networks = get(this.networksStore).data;

      return networks.find(n => n.id === networkId) ?? networks[0];
    },
    (get, set, next) => {
      set(this.selectedNetworkIdStore, next.id);
    }
  );

  private readonly store: ReturnType<typeof getDefaultStore>;

  get networks() {
    return this.store.get(this.networksStore).data;
  }

  get selectedNetwork() {
    return this.store.get(this.selectedNetworkStore);
  }

  get selectedNetworkId(): Network["id"] {
    return this.store.get(this.selectedNetworkIdStore) as Network["id"];
  }

  get deploymentVersion() {
    return this.selectedNetwork.deploymentVersion;
  }

  get marketVersion() {
    return this.selectedNetwork.marketVersion;
  }

  get escrowVersion() {
    return this.selectedNetwork.escrowVersion;
  }

  get certVersion() {
    return this.selectedNetwork.certVersion;
  }

  get providerVersion() {
    return this.selectedNetwork.providerVersion;
  }

  constructor(private readonly options: NetworkStoreOptions) {
    this.store = options.store || getDefaultStore();
    this.allNetworks = getInitialNetworksConfig({
      apiBaseUrl: this.options.apiBaseUrl
    });
    this.store.set(this.networksStore, { data: this.allNetworks, isLoading: false, error: undefined });
    if (typeof window !== "undefined") {
      this.initiateNetworkFromUrl(new URL(window.location.href));
    }
  }

  initiateNetworkFromUrl(url: URL): void {
    if (!url.searchParams.has("network")) return;

    const raw = url.searchParams.get("network");

    if (this.allNetworks.map(({ id }) => id).includes(raw as Network["id"])) {
      this.store.set(this.selectedNetworkIdStore, raw as Network["id"]);
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
