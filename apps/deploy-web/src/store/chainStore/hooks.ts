import { useEffect, useMemo } from "react";
import type { NetworkStore } from "@akashnetwork/network-store";
import type { ChainContext, ChainName, DisconnectOptions, MainWalletBase, ManagerContext, State, WalletStatus } from "@cosmos-kit/core";
import { useAtomValue } from "jotai";

import type { ChainStore } from "./chainStore";
import { getChainWalletContext } from "./utils";
import { CURRENT_WALLET_KEY } from "./walletManagerFactory";

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
        walletRepo,
        chain: walletRepo?.chainRecord?.chain,
        assets: walletRepo?.chainRecord.assetList,
        openView: () => walletRepo?.openView(),
        closeView: () => walletRepo?.closeView(),
        connect: async () => {
          await store.ensureAllWalletsLoaded();
          walletRepo?.openView();
        },
        disconnect: (options?: DisconnectOptions) => walletRepo?.disconnect(void 0, true, options),
        getRpcEndpoint: (...args: any[]) => walletRepo?.getRpcEndpoint?.(...args),
        getRestEndpoint: (...args: any[]) => walletRepo?.getRestEndpoint?.(...args),
        getStargateClient: () => walletRepo?.getStargateClient?.(),
        getCosmWasmClient: () => walletRepo?.getCosmWasmClient?.(),
        getNameService: () => walletRepo?.getNameService?.()
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
