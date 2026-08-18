import type { QueryKey } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider/ServicesProvider";
import { QueryKeys } from "./queryKeys";

/** While the managed wallet has no address yet, re-poll at this cadence so a wallet provisioned after the first fetch (registration/activation is server-side and can lag the initial query) lands without a page reload. A not-yet-created wallet reads as a null success (empty list), which keeps polling; a hard fetch failure stops it so a persistent error doesn't retry forever. */
const MANAGED_WALLET_ADDRESS_POLL_MS = 5_000;

export function useManagedWalletQuery(userId?: string) {
  const { managedWalletService } = useServices();
  return useQuery({
    queryKey: QueryKeys.getManagedWalletKey(userId) as QueryKey,
    queryFn: async () => {
      if (userId) {
        return await managedWalletService.getWallet({ userId });
      }
      return null;
    },
    enabled: !!userId,
    staleTime: Infinity,
    refetchInterval: query => {
      if (query.state.status === "error") return false;
      return query.state.data?.address ? false : MANAGED_WALLET_ADDRESS_POLL_MS;
    }
  });
}
