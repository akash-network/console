import { useMemo } from "react";
import type { ChainContext, ChainName, DisconnectOptions, MainWalletBase, ManagerContext, State, WalletManager } from "@cosmos-kit/core";
import type { WalletRepo } from "@cosmos-kit/core";
import { WalletStatus } from "@cosmos-kit/core";
import type { getDefaultStore } from "jotai";
import { atom, useAtomValue } from "jotai";

import { getChainWalletContext } from "./utils";
import { createWalletManager } from "./walletManagerFactory";
import { loadAllWallets, loadWalletByName } from "./walletRegistry";

const CURRENT_WALLET_KEY = "cosmos-kit@2:core//current-wallet";

interface ChainStoreOptions {
  store: ReturnType<typeof getDefaultStore>;
}

export class ChainStore {
  static create(options: ChainStoreOptions) {
    return new ChainStore(options);
  }

  private readonly jotaiStore: ReturnType<typeof getDefaultStore>;

  readonly walletManagerAtom = atom<WalletManager | null>(null);
  readonly stateVersionAtom = atom<number>(0);
  readonly isInitializedAtom = atom<boolean>(false);
  readonly isLoadingWalletsAtom = atom<boolean>(false);
  readonly modalIsOpenAtom = atom<boolean>(false);
  readonly modalWalletRepoAtom = atom<WalletRepo | undefined>(undefined);

  private allWalletsLoaded = false;

  constructor(options: ChainStoreOptions) {
    this.jotaiStore = options.store;
  }

  async initialize(): Promise<void> {
    if (this.jotaiStore.get(this.isInitializedAtom)) return;
    this.jotaiStore.set(this.isInitializedAtom, true);

    const storedWallet = typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_WALLET_KEY) : null;

    if (!storedWallet) return;

    this.jotaiStore.set(this.isLoadingWalletsAtom, true);

    try {
      const wallets = await loadWalletByName(storedWallet);
      const manager = createWalletManager(wallets);
      this.wireActions(manager);
      this.jotaiStore.set(this.walletManagerAtom, manager);
      await manager.onMounted();
    } catch {
      window.localStorage.removeItem(CURRENT_WALLET_KEY);
    } finally {
      this.jotaiStore.set(this.isLoadingWalletsAtom, false);
    }
  }

  async ensureAllWalletsLoaded(): Promise<void> {
    if (this.allWalletsLoaded) return;

    this.jotaiStore.set(this.isLoadingWalletsAtom, true);

    try {
      const currentManager = this.jotaiStore.get(this.walletManagerAtom);

      if (currentManager) {
        currentManager.onUnmounted();
      }

      const allWallets = await loadAllWallets();
      const manager = createWalletManager(allWallets);
      this.wireActions(manager);
      this.jotaiStore.set(this.walletManagerAtom, manager);
      await manager.onMounted();
      this.allWalletsLoaded = true;
      this.bumpVersion();
    } finally {
      this.jotaiStore.set(this.isLoadingWalletsAtom, false);
    }
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

  setModalOpen(open: boolean): void {
    this.jotaiStore.set(this.modalIsOpenAtom, open);
  }

  getDisconnectedStub(chainName: ChainName): ChainContext {
    return {
      chainWallet: undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      chain: undefined as any,
      assets: undefined,
      wallet: undefined,
      logoUrl: undefined,
      address: undefined,
      username: undefined,
      message: undefined,
      status: WalletStatus.Disconnected,
      isWalletDisconnected: true,
      isWalletConnecting: false,
      isWalletConnected: false,
      isWalletRejected: false,
      isWalletNotExist: false,
      isWalletError: false,
      connect: async () => {
        await this.ensureAllWalletsLoaded();
        const mgr = this.jotaiStore.get(this.walletManagerAtom);
        if (mgr) {
          const repo = mgr.getWalletRepo(chainName);
          repo.openView();
        }
      },
      disconnect: async () => {},
      getRpcEndpoint: () => Promise.reject(new Error("Not connected")),
      getRestEndpoint: () => Promise.reject(new Error("Not connected")),
      getStargateClient: () => Promise.reject(new Error("Not connected")),
      getCosmWasmClient: () => Promise.reject(new Error("Not connected")),
      getSigningStargateClient: () => Promise.reject(new Error("Not connected")),
      getSigningCosmWasmClient: () => Promise.reject(new Error("Not connected")),
      getNameService: () => Promise.reject(new Error("Not connected")),
      estimateFee: () => Promise.reject(new Error("Not connected")),
      sign: () => Promise.reject(new Error("Not connected")),
      broadcast: () => Promise.reject(new Error("Not connected")),
      signAndBroadcast: () => Promise.reject(new Error("Not connected")),
      qrUrl: undefined,
      appUrl: undefined,
      defaultSignOptions: undefined,
      setDefaultSignOptions: () => {},
      enable: () => Promise.reject(new Error("Not connected")),
      suggestToken: () => Promise.reject(new Error("Not connected")),
      getAccount: () => Promise.reject(new Error("Not connected")),
      getOfflineSigner: () => {
        throw new Error("Not connected");
      },
      getOfflineSignerAmino: () => {
        throw new Error("Not connected");
      },
      getOfflineSignerDirect: () => {
        throw new Error("Not connected");
      },
      signAmino: () => Promise.reject(new Error("Not connected")),
      signDirect: () => Promise.reject(new Error("Not connected")),
      signArbitrary: () => Promise.reject(new Error("Not connected")),
      sendTx: () => Promise.reject(new Error("Not connected")),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      walletRepo: undefined as any,
      openView: () => {
        this.ensureAllWalletsLoaded();
      },
      closeView: () => {}
    };
  }
}

// --- Hooks (standalone functions that close over a ChainStore instance) ---

export function createChainStoreHooks(store: ChainStore) {
  function useChain(chainName: ChainName): ChainContext {
    const manager = useAtomValue(store.walletManagerAtom);
    const version = useAtomValue(store.stateVersionAtom);

    return useMemo(() => {
      if (!manager) {
        return store.getDisconnectedStub(chainName);
      }

      const walletRepo = manager.getWalletRepo(chainName);
      walletRepo.activate();

      const { disconnect, openView, closeView, current, chainRecord, getRpcEndpoint, getRestEndpoint, getStargateClient, getCosmWasmClient, getNameService } =
        walletRepo;
      const { chain, assetList } = chainRecord;

      const chainWalletContext = chain ? getChainWalletContext(chain.chain_id, current, true) : undefined;

      return {
        ...chainWalletContext,
        walletRepo,
        chain,
        assets: assetList,
        openView,
        closeView,
        connect: async () => {
          await store.ensureAllWalletsLoaded();
          openView();
        },
        disconnect: (options?: DisconnectOptions) => disconnect(void 0, true, options),
        getRpcEndpoint,
        getRestEndpoint,
        getStargateClient,
        getCosmWasmClient,
        getNameService
      } as ChainContext;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manager, version, chainName]);
  }

  function useManager(): ManagerContext {
    const manager = useAtomValue(store.walletManagerAtom);
    const version = useAtomValue(store.stateVersionAtom);

    return useMemo(() => {
      if (!manager) {
        return {
          chainRecords: [],
          walletRepos: [],
          mainWallets: [],
          defaultNameService: "icns",
          getChainRecord: () => {
            throw new Error("WalletManager not initialized");
          },
          getWalletRepo: () => {
            throw new Error("WalletManager not initialized");
          },
          addChains: () => {
            throw new Error("WalletManager not initialized");
          },
          addEndpoints: () => {},
          getChainLogo: () => undefined,
          getNameService: () => {
            throw new Error("WalletManager not initialized");
          },
          on: () => {},
          off: () => {}
        } as unknown as ManagerContext;
      }

      return {
        chainRecords: manager.chainRecords,
        walletRepos: manager.walletRepos,
        mainWallets: manager.mainWallets,
        defaultNameService: manager.defaultNameService,
        getChainRecord: manager.getChainRecord,
        getWalletRepo: manager.getWalletRepo,
        addChains: manager.addChains,
        addEndpoints: manager.addEndpoints,
        getChainLogo: manager.getChainLogo,
        getNameService: manager.getNameService,
        on: manager.on,
        off: manager.off
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manager, version]);
  }

  function useWallet(walletName?: string) {
    const manager = useAtomValue(store.walletManagerAtom);
    const version = useAtomValue(store.stateVersionAtom);

    return useMemo(() => {
      if (!manager) {
        return {
          mainWallet: undefined,
          chainWallets: [],
          wallet: undefined,
          status: WalletStatus.Disconnected,
          message: undefined
        };
      }

      const mainWallet: MainWalletBase | undefined = walletName
        ? manager.getMainWallet(walletName)
        : manager.mainWallets.find(w => w.isActive && w.clientMutable.state !== ("Error" as State));

      if (!mainWallet) {
        return {
          mainWallet: undefined,
          chainWallets: [],
          wallet: undefined,
          status: WalletStatus.Disconnected,
          message: undefined
        };
      }

      const { walletInfo, getChainWalletList, getGlobalStatusAndMessage } = mainWallet;
      const [globalStatus, globalMessage] = getGlobalStatusAndMessage(true);

      return {
        mainWallet,
        chainWallets: getChainWalletList(false),
        wallet: walletInfo,
        status: globalStatus,
        message: globalMessage
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manager, version, walletName]);
  }

  function useWalletClient(walletName?: string) {
    const manager = useAtomValue(store.walletManagerAtom);
    const version = useAtomValue(store.stateVersionAtom);

    return useMemo(() => {
      if (!manager) {
        return {
          client: undefined,
          status: "Init" as State,
          message: undefined
        };
      }

      const mainWallet: MainWalletBase | undefined = walletName ? manager.getMainWallet(walletName) : manager.mainWallets.find(w => w.isActive);

      if (!mainWallet) {
        return {
          client: undefined,
          status: "Init" as State,
          message: undefined
        };
      }

      const { clientMutable } = mainWallet;

      return {
        client: clientMutable.data,
        status: clientMutable.state,
        message: clientMutable.message
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manager, version, walletName]);
  }

  return { useChain, useManager, useWallet, useWalletClient };
}
