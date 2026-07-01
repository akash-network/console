import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { formatBidId, parseBidId } from "@src/utils/bids/bidId";
import { ManifestYaml } from "@src/utils/deploymentData/helpers";
import { UrlService } from "@src/utils/urlUtils";
import type { BidStrategy, DeploymentIntent } from "./deploymentIntent";

export type DeploymentFlowPhase = "configuring" | "creating" | "quoting" | "closing" | "deploying" | "error";

export interface DeploymentFlowState {
  phase: DeploymentFlowPhase;
  dseq: string | null;
  bidStrategy: BidStrategy;
  /** Provider chosen per placement, keyed by placement id; value is the offer's bid id (provider/dseq/gseq/oseq). Sibling state, not a form field. */
  selections: Record<string, string>;
  /** True once the lease is created; the deploy overlay completes its progress before the brief redirect to the deployment. */
  deploySucceeded: boolean;
  deployError?: { message?: string };
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
  selectProvider: (placementId: string, bidId: string) => void;
  clearSelection: (placementId: string) => void;
  /** Creates the lease(s) and sends the manifest. The caller passes the current SDL so the manifest can be
   * rederived when it wasn't captured in this session (e.g. after a reload that resumed straight into quoting). */
  deploy: (sdl: string) => void;
}

export type DeploymentFlow = DeploymentFlowState & { actions: DeploymentFlowActions };

interface UseDeploymentFlowInput {
  intent: DeploymentIntent;
}

/** Default escrow deposit in USD (ACT maps 1:1 to USD). Matches `DEFAULT_DEPOSIT_USD` in the phased flow so a trial grant covers it. */
const DEFAULT_DEPOSIT = 0.5;

/** Hold after a successful lease so the deploy overlay's progress bar can fill to 100% and its final step turn green before redirecting. */
const DEPLOY_SUCCESS_DWELL_MS = 1200;

function useCreateDeployment() {
  return useServices().api.v1.createDeployment.useMutation();
}

function useCloseDeployment() {
  return useServices().api.v1.closeDeployment.useMutation();
}

function useCreateLease() {
  return useServices().api.v1.createLease.useMutation();
}

export const DEPENDENCIES = { useCreateDeployment, useCloseDeployment, useCreateLease, useListBids, useRouter, manifestFromSdl };

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
  const createLease = dependencies.useCreateLease();

  const [phase, setPhase] = useState<DeploymentFlowPhase>(intent.dseq ? "quoting" : "configuring");
  const [dseq, setDseq] = useState<string | null>(intent.dseq ?? null);
  const [bidStrategy, setBidStrategyState] = useState<BidStrategy>(intent.bidStrategy);
  const [error, setError] = useState<{ message?: string } | undefined>(undefined);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<{ message?: string } | undefined>(undefined);
  const [deploySucceeded, setDeploySucceeded] = useState(false);

  const intentRef = useRef(intent);
  intentRef.current = intent;

  const bidsQuery = dependencies.useListBids(dseq, { enabled: phase === "quoting", refetchInterval: BID_POLL_INTERVAL });

  const redirectTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(function clearRedirectTimerOnUnmount() {
    return function cancelPendingRedirect() {
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, []);

  useEffect(
    function pruneStaleSelections() {
      const bids = bidsQuery.data?.data;
      if (!bids || bids.length === 0) return;
      const openBidIds = new Set(bids.filter(entry => entry.bid.state === "open").map(entry => formatBidId(entry.bid.id)));
      setSelections(function dropClosedSelections(previous) {
        const survivors = Object.entries(previous).filter(([, bidId]) => openBidIds.has(bidId));
        return survivors.length === Object.keys(previous).length ? previous : Object.fromEntries(survivors);
      });
    },
    [bidsQuery.data]
  );

  const requestQuotes = useCallback(
    function requestQuotes(sdl: string) {
      setPhase("creating");
      setError(undefined);
      createDeployment.mutate(
        { data: { sdl, deposit: DEFAULT_DEPOSIT } },
        {
          onSuccess: function onCreated(result: { data: { dseq: string; manifest: string } }) {
            setDseq(result.data.dseq);
            setManifest(result.data.manifest);
            setSelections({});
            setDeployError(undefined);
            setDeploySucceeded(false);
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
            setSelections({});
            setManifest(null);
            setDeployError(undefined);
            setDeploySucceeded(false);
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

  const selectProvider = useCallback(function selectProvider(placementId: string, bidId: string) {
    setDeployError(undefined);
    setSelections(previous => ({ ...previous, [placementId]: bidId }));
  }, []);

  const clearSelection = useCallback(function clearSelection(placementId: string) {
    setSelections(function omitPlacement(previous) {
      const next = { ...previous };
      delete next[placementId];
      return next;
    });
  }, []);

  /**
   * Creates the lease(s) and sends the manifest(s) via the combined create-lease request. The manifest
   * captured at create time is used when present; on a reload that resumed straight into `quoting` it was
   * never captured, so it is rederived from the passed SDL (identical to the server's create-deployment
   * manifest, both being `manifestToSortedJSON` of the SDL's groups) rather than leaving deploy a no-op.
   * On failure it drops back to `quoting` so the progress overlay unmounts and the user is returned to where
   * they took off; `deployError` is set to drive the error toast and the header's Retry CTA. Retry re-fires
   * this same request with the current selections — provider re-selection after a lease exists is out of
   * scope here (a partial-failure-aware, idempotent retry is tracked separately).
   */
  const deploy = useCallback(
    function deploy(sdl: string) {
      const effectiveManifest = manifest ?? dependencies.manifestFromSdl(sdl);
      if (!dseq || !effectiveManifest) return;
      const leases = Object.values(selections).map(parseBidId);
      if (leases.length === 0) return;
      setDeployError(undefined);
      setDeploySucceeded(false);
      setPhase("deploying");
      createLease.mutate(
        { manifest: effectiveManifest, leases },
        {
          onSuccess: function onDeployed() {
            setDeploySucceeded(true);
            redirectTimerRef.current = setTimeout(function redirectToDeployment() {
              router.push(UrlService.deploymentDetails(dseq));
            }, DEPLOY_SUCCESS_DWELL_MS);
          },
          onError: function onDeployFailed(cause: unknown) {
            setDeployError({ message: extractApiErrorMessage(cause) ?? undefined });
            setPhase("quoting");
          }
        }
      );
    },
    [createLease, dseq, manifest, selections, router, dependencies]
  );

  return {
    phase,
    dseq,
    bidStrategy,
    selections,
    deploySucceeded,
    deployError,
    error,
    actions: { requestQuotes, cancelAndEdit, setBidStrategy, refreshQuotes, retry, selectProvider, clearSelection, deploy }
  };
}

/**
 * The provider manifest for an SDL, or null when the SDL can't be built (e.g. invalid/mid-edit). Matches the
 * server's create-deployment manifest (both are `manifestToSortedJSON` of the SDL's groups), so a session that
 * lost the captured manifest — a reload resumed straight into quoting — can still deploy from the restored SDL.
 */
function manifestFromSdl(sdl: string): string | null {
  try {
    return ManifestYaml(sdl);
  } catch {
    return null;
  }
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
