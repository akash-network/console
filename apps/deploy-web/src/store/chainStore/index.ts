import { store } from "@src/store/global-store";
import networkStore from "@src/store/networkStore";
import { ChainStore } from "./chainStore";
import { createChainStoreHooks } from "./hooks";

export type { ChainContext } from "@cosmos-kit/core";

export const chainStore = ChainStore.create({ store });
const { useChain, useManager, useWallet, useWalletClient, useSelectedChain } = createChainStoreHooks(chainStore, networkStore);

export { useChain, useManager, useWallet, useWalletClient, useSelectedChain };
