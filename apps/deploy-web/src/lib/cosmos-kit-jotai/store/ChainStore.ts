import type { MainWalletBase, WalletManager, WalletRepo } from "@cosmos-kit/core";
import type { getDefaultStore } from "jotai";
import { atom } from "jotai";

import { CURRENT_WALLET_KEY } from "./constants";
import type { WalletManagerOptions } from "./walletManagerFactory";

export interface ChainStoreOptions {
  store: ReturnType<typeof getDefaultStore>;
  localStorage?: Storage;
  walletsRegistry: WalletsRegistry;
  walletManagerOptions: Omit<WalletManagerOptions, "wallets">;
}

export class ChainStore {
  private readonly jotaiStore: ChainStoreOptions["store"];
  private readonly localStorage: ChainStoreOptions["localStorage"];
  private readonly walletsRegistry: ChainStoreOptions["walletsRegistry"];
  private readonly walletManagerOptions: ChainStoreOptions["walletManagerOptions"];

  readonly walletManagerAtom = atom<WalletManager | null>(null);
  readonly stateVersionAtom = atom(0);
  readonly modalIsOpenAtom = atom(false);
  readonly modalWalletRepoAtom = atom<WalletRepo | undefined>(undefined);
  readonly selectedWalletNameAtom = atom("");
  readonly isInitializingAtom = atom(!!this.getCurrentWalletName());

  private walletsLoadingPromise: Promise<void> | null = null;
  private initializingPromise: Promise<void> | null = null;

  constructor(options: ChainStoreOptions) {
    this.jotaiStore = options.store;
    this.localStorage = options.localStorage;
    this.walletsRegistry = options.walletsRegistry;
    this.walletManagerOptions = options.walletManagerOptions;
  }

  initialize(): Promise<void> {
    this.initializingPromise ??= this.initializeStore().catch(error => {
      this.initializingPromise = null;
      return Promise.reject(error);
    });
    return this.initializingPromise;
  }

  private async initializeStore(): Promise<void> {
    const storedWallet = this.getCurrentWalletName();
    if (!storedWallet) return;

    this.jotaiStore.set(this.selectedWalletNameAtom, storedWallet);

    try {
      this.jotaiStore.set(this.isInitializingAtom, true);
      const wallets = await loadWalletByName(this.walletsRegistry, storedWallet);
      await this.replaceManager(wallets);
    } catch {
      this.localStorage?.removeItem(CURRENT_WALLET_KEY);
      this.jotaiStore.set(this.selectedWalletNameAtom, "");
    } finally {
      this.jotaiStore.set(this.isInitializingAtom, false);
    }
  }

  ensureAllWalletsLoaded(): Promise<void> {
    if (this.walletsLoadingPromise) return this.walletsLoadingPromise;

    this.walletsLoadingPromise = loadAllWallets(this.walletsRegistry)
      .then(wallets => this.replaceManager(wallets))
      .then(() => this.forceUpdate())
      .catch(error => {
        this.walletsLoadingPromise = null;
        return Promise.reject(error);
      });
    return this.walletsLoadingPromise;
  }

  private async replaceManager(wallets: MainWalletBase[]): Promise<void> {
    const currentManager = this.jotaiStore.get(this.walletManagerAtom);
    if (currentManager) {
      currentManager.onUnmounted();
    }

    const { createWalletManager } = await import("./walletManagerFactory");
    const manager = createWalletManager({ ...this.walletManagerOptions, wallets });
    this.linkManagerToStore(manager);
    this.jotaiStore.set(this.walletManagerAtom, manager);
    await manager.onMounted();
  }

  private linkManagerToStore(manager: WalletManager): void {
    const forceUpdate = () => this.forceUpdate();
    const setModalOpen = (open: boolean) => {
      this.jotaiStore.set(this.modalIsOpenAtom, open);
    };
    const setModalWalletRepo = (repo: WalletRepo | undefined) => {
      this.jotaiStore.set(this.modalWalletRepoAtom, repo);
    };

    manager.setActions({
      viewOpen: setModalOpen,
      viewWalletRepo: setModalWalletRepo,
      data: forceUpdate,
      state: forceUpdate,
      message: forceUpdate
    });

    manager.walletRepos.forEach(wr => {
      wr.setActions({
        viewOpen: setModalOpen,
        viewWalletRepo: setModalWalletRepo,
        render: forceUpdate
      });
      wr.wallets.forEach(w => {
        w.setActions({
          data: forceUpdate,
          state: forceUpdate,
          message: forceUpdate
        });
      });
    });

    manager.mainWallets.forEach(w => {
      w.setActions({
        data: forceUpdate,
        state: forceUpdate,
        message: forceUpdate,
        clientState: forceUpdate,
        clientMessage: forceUpdate
      });
    });
  }

  private forceUpdate(): void {
    this.jotaiStore.set(this.stateVersionAtom, v => v + 1);
  }

  getManager(): WalletManager | null {
    return this.jotaiStore.get(this.walletManagerAtom);
  }

  cleanup(): void {
    const manager = this.jotaiStore.get(this.walletManagerAtom);
    if (manager) {
      manager.onUnmounted();
    }
  }

  addEndpoints(endpoints: Parameters<WalletManager["addEndpoints"]>[0]): void {
    const manager = this.jotaiStore.get(this.walletManagerAtom);
    if (manager) {
      manager.addEndpoints(endpoints);
    }
  }

  toggleModalOpen(open: boolean): void {
    this.jotaiStore.set(this.modalIsOpenAtom, open);
  }

  setSelectedWalletName(name: string): void {
    this.jotaiStore.set(this.selectedWalletNameAtom, name);
  }

  private getCurrentWalletName() {
    return this.localStorage?.getItem(CURRENT_WALLET_KEY);
  }
}

type WalletsRegistry = Record<string, () => Promise<{ wallets: MainWalletBase[] }>>;
async function loadWalletByName(registry: WalletsRegistry, name: string): Promise<MainWalletBase[]> {
  const loader = registry[name];
  if (!loader) {
    throw new Error(`Unknown wallet: ${name}`);
  }
  const { wallets } = await loader();
  return wallets;
}

async function loadAllWallets(registry: WalletsRegistry): Promise<MainWalletBase[]> {
  const wallets = await Promise.all(Object.keys(registry).map(name => loadWalletByName(registry, name)));
  return wallets.flat();
}
