import type { MainWalletBase, WalletManager, WalletRepo } from "@cosmos-kit/core";
import type { getDefaultStore } from "jotai";
import { atom } from "jotai";

import { CURRENT_WALLET_KEY } from "./constants";
import { loadAllWallets, loadWalletByName } from "./walletRegistry";

export interface ChainStoreOptions {
  store: ReturnType<typeof getDefaultStore>;
}

export class ChainStore {
  static create(options: ChainStoreOptions) {
    return new ChainStore(options);
  }

  private readonly jotaiStore: ReturnType<typeof getDefaultStore>;

  readonly walletManagerAtom = atom<WalletManager | null>(null);
  readonly stateVersionAtom = atom(0);
  readonly isInitializedAtom = atom(false);
  readonly modalIsOpenAtom = atom(false);
  readonly modalWalletRepoAtom = atom<WalletRepo | undefined>(undefined);
  readonly selectedWalletNameAtom = atom("");
  readonly isInitializingAtom = atom(!!getCurrentWalletName());

  private walletsLoadingPromise: Promise<void> | null = null;

  constructor(options: ChainStoreOptions) {
    this.jotaiStore = options.store;
  }

  async initialize(): Promise<void> {
    if (this.jotaiStore.get(this.isInitializedAtom)) return;
    this.jotaiStore.set(this.isInitializedAtom, true);

    const storedWallet = getCurrentWalletName();

    if (!storedWallet) return;

    this.jotaiStore.set(this.selectedWalletNameAtom, storedWallet);

    try {
      this.jotaiStore.set(this.isInitializingAtom, true);
      const wallets = await loadWalletByName(storedWallet);
      await this.replaceManager(wallets);
    } catch {
      window.localStorage?.removeItem(CURRENT_WALLET_KEY);
    } finally {
      this.jotaiStore.set(this.isInitializingAtom, false);
    }
  }

  ensureAllWalletsLoaded(): Promise<void> {
    if (this.walletsLoadingPromise) return this.walletsLoadingPromise;

    this.jotaiStore.set(this.isInitializingAtom, true);
    this.walletsLoadingPromise = loadAllWallets()
      .then(wallets => this.replaceManager(wallets))
      .then(() => this.bumpVersion())
      .catch(() => {
        // loading failed, allow retry
        this.walletsLoadingPromise = null;
      })
      .finally(() => {
        this.jotaiStore.set(this.isInitializingAtom, false);
      });
    return this.walletsLoadingPromise;
  }

  private async replaceManager(wallets: MainWalletBase[]): Promise<void> {
    const currentManager = this.jotaiStore.get(this.walletManagerAtom);
    if (currentManager) {
      currentManager.onUnmounted();
    }

    const { createWalletManager } = await import("./walletManagerFactory");
    const manager = createWalletManager(wallets);
    this.wireActions(manager);
    this.jotaiStore.set(this.walletManagerAtom, manager);
    await manager.onMounted();
  }

  private wireActions(manager: WalletManager): void {
    const bump = () => this.bumpVersion();
    const setModalOpen = (open: boolean) => {
      this.jotaiStore.set(this.modalIsOpenAtom, open);
    };
    const setModalWalletRepo = (repo: WalletRepo | undefined) => {
      this.jotaiStore.set(this.modalWalletRepoAtom, repo);
    };

    manager.setActions({
      viewOpen: setModalOpen,
      viewWalletRepo: setModalWalletRepo,
      data: bump,
      state: bump,
      message: bump
    });

    manager.walletRepos.forEach(wr => {
      wr.setActions({
        viewOpen: setModalOpen,
        viewWalletRepo: setModalWalletRepo,
        render: bump
      });
      wr.wallets.forEach(w => {
        w.setActions({
          data: bump,
          state: bump,
          message: bump
        });
      });
    });

    manager.mainWallets.forEach(w => {
      w.setActions({
        data: bump,
        state: bump,
        message: bump,
        clientState: bump,
        clientMessage: bump
      });
    });
  }

  private bumpVersion(): void {
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
}

function getCurrentWalletName() {
  return typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_WALLET_KEY) : null;
}
