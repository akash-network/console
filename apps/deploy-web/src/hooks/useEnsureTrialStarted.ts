import { useEffect } from "react";

import { useManagedWallet } from "@src/hooks/useManagedWallet";

export const DEPENDENCIES = {
  useManagedWallet
};

export type EnsureTrialStartedResult = {
  isWalletReady: boolean;
  isLoading: boolean;
  error: ReturnType<typeof useManagedWallet>["createError"];
  refreshWallet: ReturnType<typeof useManagedWallet>["refetch"];
};

/**
 * Auto-starts the user's trial in the background, without requiring an explicit
 * "Start Trial" click. Assumes the user is authenticated (and therefore email-verified
 * via passwordless) by the time this runs — the auth guard ensures that upstream.
 *
 * Within-mutation retries are handled by React Query (see `useCreateManagedWalletMutation`);
 * we stop firing once the mutation terminally errors so we don't infinite-loop.
 *
 * Use only on pages that are part of the onboarding redesign — the call is unguarded.
 */
export const useEnsureTrialStarted = (d: typeof DEPENDENCIES = DEPENDENCIES): EnsureTrialStartedResult => {
  const { wallet, create, isLoading, createError, refetch } = d.useManagedWallet();
  const isWalletReady = !!wallet?.address;

  useEffect(() => {
    if (isWalletReady) return;
    if (isLoading) return;
    if (createError) return;
    create();
  }, [isWalletReady, isLoading, createError, create]);

  return { isWalletReady, isLoading, error: createError, refreshWallet: refetch };
};
