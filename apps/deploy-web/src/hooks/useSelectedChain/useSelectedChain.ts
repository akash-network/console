import { type ChainContext, useChain } from "@src/lib/cosmos-kit-jotai";
import networkStore from "@src/store/networkStore";

export function useSelectedChain(): ChainContext {
  const { chainRegistryName } = networkStore.useSelectedNetwork();
  return useChain(chainRegistryName);
}
