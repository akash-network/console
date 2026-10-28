import { useMemo } from "react";
import type { ApiManagedWalletOutput } from "@akashnetwork/http-sdk";

import { useUser } from "@src/hooks/useUser";
import { useManagedWalletQuery } from "@src/queries/useManagedWalletQuery";

export const useManagedWallet = () => {
  const { user } = useUser();
  const { data: queried, isLoading, isPending, isFetched, isFetching, isError, refetch } = useManagedWalletQuery(user?.id);
  const wallet = queried as ApiManagedWalletOutput | undefined;
  /** React Query reports `isLoading` again while it retries a failed first lookup, which must not re-close the wallet boot gate. */
  const isInitialLoading = isLoading && !isFetched;
  /** That retry also clears `isError` while it runs, yet the lookup has still not succeeded. */
  const isLookupFailed = isError || (isPending && isFetched);

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
