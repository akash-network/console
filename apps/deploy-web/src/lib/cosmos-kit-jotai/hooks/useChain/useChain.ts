import { useEffect, useMemo } from "react";
import type { ChainContext, ChainName, DisconnectOptions } from "@cosmos-kit/core";
import { useAtomValue } from "jotai";

import { useChainStore } from "../../context/ChainStoreProvider";
import { CURRENT_WALLET_KEY } from "../../store/constants";
import { getChainWalletContext } from "../../store/utils";

export type { ChainContext };

export function useChain(chainName: ChainName): ChainContext {
  const store = useChainStore();
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

    const storedWallet = typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_WALLET_KEY) : null;
    if (storedWallet) {
      const walletRepo = manager.getWalletRepo(chainName);
      walletRepo.connect(storedWallet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manager, chainName]);

  return context;
}
