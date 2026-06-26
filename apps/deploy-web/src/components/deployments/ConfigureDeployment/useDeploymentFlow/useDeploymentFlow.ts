import { useCallback, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { UrlService } from "@src/utils/urlUtils";
import type { BidStrategy, DeploymentIntent } from "./deploymentIntent";

export type DeploymentFlowPhase = "configuring" | "creating" | "quoting" | "closing" | "error";

export interface DeploymentFlowState {
  phase: DeploymentFlowPhase;
  dseq: string | null;
  bidStrategy: BidStrategy;
  error?: { message?: string };
}

export interface DeploymentFlowActions {
  /** Creates the deployment from the given SDL. The caller passes the SDL generated from the just-submitted
   * form values so the request can never lag behind an in-flight edit. */
  requestQuotes: (sdl: string) => void;
  cancelAndEdit: () => void;
  setBidStrategy: (strategy: BidStrategy) => void;
  refreshQuotes: () => void;
  retry: () => void;
}

export type DeploymentFlow = DeploymentFlowState & { actions: DeploymentFlowActions };

interface UseDeploymentFlowInput {
  intent: DeploymentIntent;
}

/** Default escrow deposit in USD (ACT maps 1:1 to USD). Matches `DEFAULT_DEPOSIT_USD` in the phased flow so a trial grant covers it. */
const DEFAULT_DEPOSIT = 0.5;

function useCreateDeployment() {
  return useServices().api.v1.createDeployment.useMutation();
}

function useCloseDeployment() {
  return useServices().api.v1.closeDeployment.useMutation();
}

export const DEPENDENCIES = { useCreateDeployment, useCloseDeployment, useRouter };

/**
 * Controlled lifecycle state machine for the configure flow. Owns interaction state (phase, dseq,
 * bidStrategy) and mirrors dseq/bid-strategy to the URL; server state (screened providers, bids)
 * lives in react-query via `usePlacementOffers`. Resumes in `quoting` when the URL already carries
 * a dseq, so a reload picks up live bids rather than restarting.
 */
export function useDeploymentFlow({ intent }: UseDeploymentFlowInput, dependencies: typeof DEPENDENCIES = DEPENDENCIES): DeploymentFlow {
  const router = dependencies.useRouter();
  const createDeployment = dependencies.useCreateDeployment();
  const closeDeployment = dependencies.useCloseDeployment();

  const [phase, setPhase] = useState<DeploymentFlowPhase>(intent.dseq ? "quoting" : "configuring");
  const [dseq, setDseq] = useState<string | null>(intent.dseq ?? null);
  const [bidStrategy, setBidStrategyState] = useState<BidStrategy>(intent.bidStrategy);
  const [error, setError] = useState<{ message?: string } | undefined>(undefined);

  const intentRef = useRef(intent);
  intentRef.current = intent;

  const requestQuotes = useCallback(
    function requestQuotes(sdl: string) {
      setPhase("creating");
      setError(undefined);
      createDeployment.mutate(
        { data: { sdl, deposit: DEFAULT_DEPOSIT } },
        {
          onSuccess: function onCreated(result: { data: { dseq: string; manifest: string } }) {
            setDseq(result.data.dseq);
            setPhase("quoting");
            router.replace(buildConfigureUrl(intentRef.current, result.data.dseq, bidStrategy), undefined, { shallow: true });
          },
          onError: function onCreateFailed(cause: unknown) {
            setError({ message: extractApiErrorMessage(cause) ?? undefined });
            setPhase("error");
          }
        }
      );
    },
    [createDeployment, router, bidStrategy]
  );

  const cancelAndEdit = useCallback(
    function cancelAndEdit() {
      if (!dseq) {
        setPhase("configuring");
        return;
      }
      setPhase("closing");
      setError(undefined);
      closeDeployment.mutate(
        { dseq },
        {
          onSuccess: function onClosed() {
            setDseq(null);
            setPhase("configuring");
            router.replace(buildConfigureUrl(intentRef.current, undefined, bidStrategy), undefined, { shallow: true });
          },
          onError: function onCloseFailed(cause: unknown) {
            setError({ message: extractApiErrorMessage(cause) ?? undefined });
            setPhase("error");
          }
        }
      );
    },
    [closeDeployment, dseq, router, bidStrategy]
  );

  const setBidStrategy = useCallback(
    function setBidStrategy(strategy: BidStrategy) {
      setBidStrategyState(strategy);
      router.replace(buildConfigureUrl(intentRef.current, dseq ?? undefined, strategy), undefined, { shallow: true });
    },
    [router, dseq]
  );

  const refreshQuotes = useCallback(function refreshQuotes() {
    setPhase("quoting");
  }, []);

  const retry = useCallback(
    function retry() {
      setError(undefined);
      setPhase(dseq ? "quoting" : "configuring");
    },
    [dseq]
  );

  return { phase, dseq, bidStrategy, error, actions: { requestQuotes, cancelAndEdit, setBidStrategy, refreshQuotes, retry } };
}

/** Builds the canonical configure URL preserving templateId/sdl-strategy/draftId and the current dseq + bid-strategy. */
export function buildConfigureUrl(intent: DeploymentIntent, dseq: string | undefined, bidStrategy: BidStrategy): string {
  return UrlService.configureDeployment({
    dseq,
    templateId: intent.templateId,
    sdlStrategy: intent.templateId ? intent.sdlStrategy : undefined,
    bidStrategy,
    draftId: intent.draftId
  });
}
