import { useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";

import { useUser } from "@src/hooks/useUser";
import { useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";

export const useManagedWallet = () => {
  const { user } = useUser();
  const { data: queried, isLoading, isFetched, isFetching, isError: isLookupFailed, refetch } = useManagedWalletQuery(user?.id);
  const wallet = queried as ApiManagedWalletOutput | undefined;
  /** React Query reports `isLoading` again while it retries a failed first lookup, which must not re-close the wallet boot gate. */
  const isInitialLoading = isLoading && !isFetched;

  return useMemo(() => {
    return {
      wallet: wallet || undefined,
      /**
       * True only during the initial wallet-existence lookup. Consumers gating on "do we yet know the user's
       * wallet situation?" (the wallet boot gate) use this so a provisioning trial reads as known identity and
       * doesn't blank the page with a full-screen loader.
       */
      isInitializing: isInitialLoading,
      isFetching,
      isLookupFailed,
      refetch
    };
  }, [wallet, isInitialLoading, isFetching, isLookupFailed, refetch]);
};
