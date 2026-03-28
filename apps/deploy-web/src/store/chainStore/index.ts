import { store } from "@src/store/global-store";
import networkStore from "@src/store/networkStore";
import { ChainStore, createChainStoreHooks } from "./chainStore";

export type { ChainContext } from "@cosmos-kit/core";

const chainStore = ChainStore.create({ store });
const { useChain, useManager, useWallet, useWalletClient } = createChainStoreHooks(chainStore);

export function useSelectedChain() {
  const { chainRegistryName } = networkStore.useSelectedNetwork();
  return useChain(chainRegistryName);
}

export { useChain, useManager, useWallet, useWalletClient };
export default chainStore;
