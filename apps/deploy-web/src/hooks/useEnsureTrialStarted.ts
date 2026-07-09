import { useCallback, useEffect } from "react";
import { useIsMutating } from "@tanstack/react-query";

import { useManagedWallet } from "@src/hooks/useManagedWallet";
import { QueryKeys } from "@src/queries/queryKeys";

export const DEPENDENCIES = {
  useManagedWallet,
  useIsMutating
};

export type EnsureTrialStartedResult = {
  isWalletReady: boolean;
  isLoading: boolean;
  error: ReturnType<typeof useManagedWallet>["createError"];
  refreshWallet: ReturnType<typeof useManagedWallet>["refetch"];
  /**
   * Clears a terminal start-trial failure so the trial can be re-attempted. A terminal `createError` is otherwise
   * sticky for the session (React Query keeps a settled mutation's error until it's reset), which would make every
   * downstream deploy retry a dead-end. Resetting drops `createError`, which lets the effect below fire `create()`
   * again. Wire it into the deploy retry affordances (the configure header, the auto flow's "Try again").
   */
  retryTrial: () => void;
};

/**
 * Auto-starts the user's trial in the background, without requiring an explicit
 * "Start Trial" click. Assumes the user is authenticated (and therefore email-verified
 * via passwordless) by the time this runs — the auth guard ensures that upstream.
 *
 * Within-mutation retries are handled by React Query (see `useCreateManagedWalletMutation`);
 * we stop firing once the mutation terminally errors so we don't infinite-loop. A terminal error is
 * recovered explicitly via {@link EnsureTrialStartedResult.retryTrial} (wired to the deploy retry buttons),
 * not by auto-refiring here.
 *
 * The start survives navigation: the mutation's local pending flag resets when this hook remounts on a new page
 * (e.g. onboarding → configure), so instead we gate on the globally-observed in-flight state via `useIsMutating`.
 * That keeps a create that began on a previous page from re-firing here while it's still running.
 *
 * Use only on pages that are part of the onboarding redesign — the call is unguarded.
 */
export const useEnsureTrialStarted = (d: typeof DEPENDENCIES = DEPENDENCIES): EnsureTrialStartedResult => {
  const { wallet, create, isLoading, createError, resetCreate, refetch } = d.useManagedWallet();
  const isWalletReady = !!wallet?.address;
  const isStartingTrial = d.useIsMutating({ mutationKey: QueryKeys.getManagedWalletCreateMutationKey() }) > 0;

  useEffect(() => {
    if (isWalletReady) return;
    if (isLoading) return;
    if (createError) return;
    if (isStartingTrial) return;
    create();
  }, [isWalletReady, isLoading, createError, isStartingTrial, create]);

  const retryTrial = useCallback(() => resetCreate(), [resetCreate]);

  return { isWalletReady, isLoading, error: createError, refreshWallet: refetch, retryTrial };
};
