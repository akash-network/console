import type { ManagerContext } from "@cosmos-kit/core";
import { useAtomValue } from "jotai";

import { useChainStore } from "../../context/ChainStoreProvider";

export type { ManagerContext };

export function useManager(): ManagerContext | null {
  const store = useChainStore();
  const manager = useAtomValue(store.walletManagerAtom);

  return manager;
}
