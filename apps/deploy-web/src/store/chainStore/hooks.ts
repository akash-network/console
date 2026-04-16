import { useEffect, useMemo } from "react";
import type { NetworkStore } from "@akashnetwork/network-store";
import type { ChainContext, ChainName, DisconnectOptions, MainWalletBase, ManagerContext, State, WalletStatus } from "@cosmos-kit/core";
import { useAtomValue } from "jotai";

import type { ChainStore } from "./chainStore";
import { CURRENT_WALLET_KEY } from "./constants";
import { getChainWalletContext } from "./utils";

export function createChainStoreHooks(store: ChainStore, networkStore: NetworkStore) {
  function useChain(chainName: ChainName): ChainContext {
    const manager = useAtomValue(store.walletManagerAtom);
    const version = useAtomValue(store.stateVersionAtom);

    const context = useMemo(() => {
      const walletRepo = manager?.getWalletRepo(chainName);
      walletRepo?.activate();

      const chainWalletContext = getChainWalletContext(walletRepo?.chainRecord.chain?.chain_id ?? chainName, walletRepo?.current, true);

      return {
        ...chainWalletContext,
        get walletRepo() {
          return store.getManager()?.getWalletRepo(chainName);
        },
        get chain() {
          return store.getManager()?.getWalletRepo(chainName)?.chainRecord?.chain;
        },
        get assets() {
          return store.getManager()?.getWalletRepo(chainName)?.chainRecord?.assetList;
        },
        openView: () => store.getManager()?.getWalletRepo(chainName)?.openView(),
        closeView: () => store.getManager()?.getWalletRepo(chainName)?.closeView(),
        async connect() {
          await store.ensureAllWalletsLoaded();
          store.getManager()?.getWalletRepo(chainName)?.openView();
        },
        disconnect: (options?: DisconnectOptions) =>
          store
            .getManager()
            ?.getWalletRepo(chainName)
            ?.disconnect(void 0, true, options),
        getRpcEndpoint: (...args: any[]) =>
          store
            .getManager()
            ?.getWalletRepo(chainName)
            ?.getRpcEndpoint?.(...args),
        getRestEndpoint: (...args: any[]) =>
          store
            .getManager()
            ?.getWalletRepo(chainName)
            ?.getRestEndpoint?.(...args),
        getStargateClient: () => store.getManager()?.getWalletRepo(chainName)?.getStargateClient?.(),
        getCosmWasmClient: () => store.getManager()?.getWalletRepo(chainName)?.getCosmWasmClient?.(),
        getNameService: () => store.getManager()?.getWalletRepo(chainName)?.getNameService?.()
      } as ChainContext;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manager, version, chainName]);

    useEffect(() => {
      if (!manager || !context.isWalletDisconnected) return;

      const storedWallet = window.localStorage.getItem(CURRENT_WALLET_KEY);
      if (storedWallet) {
        const walletRepo = manager.getWalletRepo(chainName);
        walletRepo.connect(storedWallet);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [manager, chainName]);

    return context;
  }

  function useManager(): ManagerContext {
    const manager = useAtomValue(store.walletManagerAtom);
    const version = useAtomValue(store.stateVersionAtom);

    return useMemo(() => {
      if (manager) return manager;

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
          status: "Disconnected" as WalletStatus.Disconnected,
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
          status: "Disconnected" as WalletStatus.Disconnected,
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

  function useSelectedChain() {
    const { chainRegistryName } = networkStore.useSelectedNetwork();
    return useChain(chainRegistryName);
  }

  return { useChain, useManager, useWallet, useWalletClient, useSelectedChain };
}
