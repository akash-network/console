import type { SetStateAction } from "jotai";
import { atom } from "jotai";
import { getDefaultStore, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { getInitialNetworksConfig } from "./network.config";
import type { Network } from "./network.type";

interface NetworkStoreOptions {
  defaultNetworkId: Network["id"];
  apiBaseUrl: string;
  store?: ReturnType<typeof getDefaultStore>;
  /**
   * Pins the store to `defaultNetworkId`: `selectedNetworkId` becomes a constant, its setter throws, and a
   * `?network=` URL param is ignored (a fixed store has no other network to switch to). Single-network apps
   * (deploy-web is managed-wallet-only) set this so the network can neither be switched nor drift out of
   * localStorage. Omit for multi-network apps (stats-web) that switch at runtime.
   */
  fixed?: boolean;
}

interface NetworksStore {
  isLoading: boolean;
  error?: Error;
  data: Network[];
}

export class NetworkStore {
  static create(options: NetworkStoreOptions): NetworkStore {
    return new NetworkStore(options);
  }

  private readonly STORAGE_KEY = "selectedNetworkId";

  private readonly allNetworks: Network[];
  readonly networksStore = atom<NetworksStore>({ isLoading: true, error: undefined, data: [] });

  private readonly selectedNetworkIdStore = this.options.fixed
    ? atom<Network["id"], [Network["id"]], void>(
        () => this.options.defaultNetworkId,
        () => {
          throw new Error(`Cannot change network: the store is fixed to "${this.options.defaultNetworkId}".`);
        }
      )
    : atomWithStorage<Network["id"]>(this.STORAGE_KEY, this.options.defaultNetworkId, undefined, { getOnInit: true });

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

  get networks(): Network[] {
    return this.store.get(this.networksStore).data;
  }

  get selectedNetwork(): Network {
    return this.store.get(this.selectedNetworkStore);
  }

  get selectedNetworkId(): Network["id"] {
    return this.store.get(this.selectedNetworkIdStore) as Network["id"];
  }

  get deploymentVersion(): Network["deploymentVersion"] {
    return this.selectedNetwork.deploymentVersion;
  }

  get marketVersion(): Network["marketVersion"] {
    return this.selectedNetwork.marketVersion;
  }

  get escrowVersion(): Network["escrowVersion"] {
    return this.selectedNetwork.escrowVersion;
  }

  get certVersion(): Network["certVersion"] {
    return this.selectedNetwork.certVersion;
  }

  get providerVersion(): Network["providerVersion"] {
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
    if (this.options.fixed) return;
    if (!url.searchParams.has("network")) return;

    const raw = url.searchParams.get("network");

    if (this.allNetworks.map(({ id }) => id).includes(raw as Network["id"])) {
      this.store.set(this.selectedNetworkIdStore, raw as Network["id"]);
    }
  }

  useNetworksStore(): [NetworksStore, (update: SetStateAction<NetworksStore>) => void] {
    return useAtom(this.networksStore);
  }

  useNetworks(): Network[] {
    return this.useNetworksStore()[0].data;
  }

  useSelectedNetworkStore(): [Network, (network: Network) => void] {
    return useAtom(this.selectedNetworkStore);
  }

  useSelectedNetwork(): Network {
    return this.useSelectedNetworkStore()[0];
  }

  useSelectedNetworkIdStore({ reloadOnChange } = { reloadOnChange: false }): [Network["id"], (networkId: Network["id"]) => void] {
    const [networkId, setNetworkId] = useAtom(this.selectedNetworkIdStore);

    if (this.options.fixed && reloadOnChange) {
      throw new Error(`Cannot reload on network change: the store is fixed to "${this.options.defaultNetworkId}".`);
    }

    if (reloadOnChange) {
      return [
        networkId,
        (networkId: Network["id"]) => {
          const url = new URL(window.location.href);
          url.searchParams.set("network", networkId);
          window.location.href = url.toString();
        }
      ];
    }

    return [networkId, setNetworkId];
  }

  useSelectedNetworkId(): Network["id"] {
    return this.useSelectedNetworkIdStore()[0];
  }
}
