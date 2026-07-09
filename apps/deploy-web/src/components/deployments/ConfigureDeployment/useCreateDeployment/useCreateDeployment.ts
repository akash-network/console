import { useCallback, useEffect, useMemo, useRef } from "react";

import { useServices } from "@src/context/ServicesProvider";

function useCreateDeploymentMutation() {
  return useServices().api.v1.createDeployment.useMutation();
}

export const DEPENDENCIES = {
  useCreateDeploymentMutation
};

type CreateDeploymentMutation = ReturnType<typeof useCreateDeploymentMutation>;
type Mutate = CreateDeploymentMutation["mutate"];
type MutateVariables = Parameters<Mutate>[0];
type MutateOptions = Parameters<Mutate>[1];

export type UseCreateDeploymentOptions = {
  /** Whether the trial wallet is provisioned and can sign a create-deployment broadcast. */
  isWalletReady: boolean;
  /** A terminal start-trial failure; when set, a held create is failed rather than kept waiting. */
  trialError?: unknown;
};

/**
 * The create-deployment mutation, gated on the trial wallet. Deployment creation is the one action every configure
 * path (manual form and auto-deploy) funnels through, so "wait until the wallet can broadcast" lives here rather
 * than at each call site: `mutate` is held until the wallet is ready, then flushed with the original arguments; a
 * terminal trial error fails a held call through the same `onError` channel, so the surrounding flow surfaces it
 * like any other create failure. When the wallet is already ready — the common case, e.g. an existing user — the
 * call fires straight through.
 *
 * A held call is deferred rather than failed synchronously even when `trialError` is already set: the flush effect
 * (not `gatedMutate`) owns the fail-on-error decision, reading the latest `trialError`. That lets a retry which
 * resets the trial (clearing `trialError`) rescue the held create — it flushes when the re-attempted trial
 * provisions — instead of the create failing against a stale error captured at click time.
 */
export function useCreateDeployment(
  { isWalletReady, trialError }: UseCreateDeploymentOptions,
  d: typeof DEPENDENCIES = DEPENDENCIES
): CreateDeploymentMutation {
  const mutation = d.useCreateDeploymentMutation();
  const { mutate } = mutation;
  const pendingRef = useRef<{ variables: MutateVariables; options?: MutateOptions } | null>(null);

  useEffect(
    function flushWhenTrialSettles() {
      const pending = pendingRef.current;
      if (!pending) return;
      if (isWalletReady) {
        pendingRef.current = null;
        mutate(pending.variables, pending.options);
      } else if (trialError) {
        pendingRef.current = null;
        pending.options?.onError?.(trialError as never, pending.variables, undefined as never);
      }
    },
    [isWalletReady, trialError, mutate]
  );

  const gatedMutate = useCallback<Mutate>(
    function mutateWhenTrialReady(variables, options) {
      if (isWalletReady) {
        mutate(variables, options);
      } else {
        pendingRef.current = { variables, options };
      }
    },
    [isWalletReady, mutate]
  );

  return useMemo(() => ({ ...mutation, mutate: gatedMutate }), [mutation, gatedMutate]);
}
