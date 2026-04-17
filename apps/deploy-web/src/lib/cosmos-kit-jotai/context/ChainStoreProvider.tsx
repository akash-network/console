import { createContext, useContext, useMemo } from "react";
import { useStore } from "jotai";

import type { ChainStoreOptions } from "../store/ChainStore";
import { ChainStore } from "../store/ChainStore";

const StoreContext = createContext<ChainStore | null>(null);

export interface ChainStoreProviderProps {
  children: React.ReactNode;
  walletsRegistry: ChainStoreOptions["walletsRegistry"];
  walletManagerOptions: ChainStoreOptions["walletManagerOptions"];
}

export function ChainStoreProvider({ children, walletsRegistry, walletManagerOptions }: ChainStoreProviderProps) {
  const store = useStore();
  const chainStore = useMemo(
    () =>
      new ChainStore({
        store,
        walletsRegistry,
        walletManagerOptions,
        localStorage: typeof window !== "undefined" ? window.localStorage : undefined
      }),
    [store, walletsRegistry, walletManagerOptions]
  );
  return <StoreContext.Provider value={chainStore}>{children}</StoreContext.Provider>;
}

export function useChainStore(): ChainStore {
  const store = useContext(StoreContext);
  if (!store) {
    throw new Error("useChainStore must be used within a ChainStoreProvider");
  }
  return store;
}
