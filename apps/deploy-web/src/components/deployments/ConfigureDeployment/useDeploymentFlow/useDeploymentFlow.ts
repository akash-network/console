import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { settingsIdAtom } from "@src/context/SettingsProvider/settingsStore";
import { QueryKeys } from "@src/queries/queryKeys";
import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { formatBidId, parseBidId } from "@src/utils/bids/bidId";
import { ManifestYaml } from "@src/utils/deploymentData/helpers";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { UrlService } from "@src/utils/urlUtils";
import { aggregateDeploymentResources } from "../DeploymentResourceSummary/deploymentResources";
import { useCreateDeployment } from "../useCreateDeployment/useCreateDeployment";
import type { BidStrategy, DeploymentIntent } from "./deploymentIntent";

export type DeploymentFlowPhase = "configuring" | "creating" | "quoting" | "closing" | "deploying" | "error";

/** The live bids the flow polls while quoting (react-query-backed). Element shape derived from the shared `listBids` query. */
export type DeploymentBids = NonNullable<ReturnType<typeof useListBids>["data"]>["data"];

export interface DeploymentFlowState {
  phase: DeploymentFlowPhase;
  dseq: string | null;
  bidStrategy: BidStrategy;
  /** Provider chosen per placement, keyed by placement id; value is the offer's bid id (provider/dseq/gseq/oseq). Sibling state, not a form field. */
  selections: Record<string, string>;
  /**
   * Live bids for the current dseq while quoting, from the same react-query entry the flow polls. Empty otherwise.
   * Surfaced so the auto flow can match a provider off the flow's own query rather than re-declaring `listBids`.
   */
  bids: DeploymentBids;
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
  /**
   * Whether the trial wallet can broadcast. Threaded into the create step so requesting quotes waits for the trial
   * to provision instead of failing; defaults to ready so callers with a real wallet (or tests) fire immediately.
   */
  isWalletReady?: boolean;
  /** A terminal start-trial failure, surfaced so a held create fails instead of waiting forever. */
  trialError?: unknown;
}

/** Default escrow deposit in USD (ACT maps 1:1 to USD). Matches `DEFAULT_DEPOSIT_USD` in the phased flow so a trial grant covers it. */
const DEFAULT_DEPOSIT = 0.5;

/** Hold after a successful lease so the deploy overlay's progress bar can fill to 100% and its final step turn green before redirecting. */
const DEPLOY_SUCCESS_DWELL_MS = 1200;

/**
 * Wait this long for a first bid before failing fast — some specs never draw one (niche resources, tight filters, a
 * quiet marketplace), and the full ~5-minute quote window only makes sense once bids exist. Resets when any bid lands.
 */
const NO_BIDS_TIMEOUT_MS = 60 * 1000;

/** Error surfaced when a deployment draws no provider bids at all within {@link NO_BIDS_TIMEOUT_MS}. */
const NO_PROVIDERS_MESSAGE = "No providers are available for this deployment right now. Try adjusting your deployment and requesting quotes again.";

export const DEPENDENCIES = {
  useServices,
  useCreateDeployment,
  useListBids,
  useRouter,
  useQueryClient,
  manifestFromSdl,
  deploymentResourcesFromSdl
};

/**
 * Controlled lifecycle state machine for the configure flow. Owns interaction state (phase, dseq,
 * bidStrategy) and mirrors dseq/bid-strategy to the URL; server state (screened providers, bids)
 * lives in react-query via `usePlacementOffers`. Resumes in `quoting` when the URL already carries
 * a dseq, so a reload picks up live bids rather than restarting.
 */
export function useDeploymentFlow(
  { intent, isWalletReady = true, trialError }: UseDeploymentFlowInput,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): DeploymentFlow {
  const { api, deploymentLocalStorage, analyticsService } = dependencies.useServices();
  const router = dependencies.useRouter();
  const createDeployment = dependencies.useCreateDeployment({ isWalletReady, trialError });
  const closeDeployment = api.v1.closeDeployment.useMutation();
  const createLease = api.v1.createLease.useMutation();
  const updateDeployment = api.v1.updateDeployment.useMutation();
  const queryClient = dependencies.useQueryClient();
  const settingsId = useAtomValue(settingsIdAtom);

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

  /** Read in the async create-success callback so a create resolving after a strategy switch uses the current value. */
  const bidStrategyRef = useRef(bidStrategy);
  bidStrategyRef.current = bidStrategy;

  /** Held in a ref so the no-providers timeout calls the latest `cancelAndEdit` without re-arming the timer each render. */
  const cancelAndEditRef = useRef<() => void>();

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

  const hasOpenBids = (bidsQuery.data?.data ?? []).some(entry => entry.bid.state === "open");

  /** One-shot latch: once any bid appears the no-providers timeout must not re-arm — a later empty list is quote-expiry, not "no providers". */
  const providersEverBidRef = useRef(false);

  const bidsReceivedTrackedRef = useRef(false);

  useEffect(
    function trackFirstBidsReceived() {
      const currentBids = bidsQuery.data?.data;
      if (!currentBids || currentBids.length === 0 || bidsReceivedTrackedRef.current) return;
      bidsReceivedTrackedRef.current = true;
      analyticsService.track("bids_received", { category: "deployments", numberOfBids: currentBids.length, dseq });
    },
    [bidsQuery.data, dseq, analyticsService]
  );

  useEffect(
    function failWhenNoProvidersBid() {
      if (hasOpenBids) providersEverBidRef.current = true;
      if (phase !== "quoting" || providersEverBidRef.current) return;
      const timer = setTimeout(
        /**
         * The auto flow autopilots over this shared flow and reads its error scene off `phase === "error"`, so it must
         * halt there; the manual flow has no autopilot, so close the dangling deployment and drop back to editing.
         */
        function timeOutWithoutProviders() {
          if (intentRef.current.sdlStrategy === "default" && bidStrategyRef.current === "auto") {
            setError({ message: NO_PROVIDERS_MESSAGE });
            setPhase("error");
            return;
          }
          cancelAndEditRef.current?.();
          setError({ message: NO_PROVIDERS_MESSAGE });
        },
        NO_BIDS_TIMEOUT_MS
      );
      return function cancelNoProvidersTimeout() {
        clearTimeout(timer);
      };
    },
    [phase, hasOpenBids]
  );

  /**
   * Caches the SDL under the settings id + dseq at create time (the create response omits `owner`) so an in-progress
   * deployment can resume into the flow after a reload — the same key the detail page reads.
   */
  const requestQuotes = useCallback(
    function requestQuotes(sdl: string) {
      providersEverBidRef.current = false;
      bidsReceivedTrackedRef.current = false;
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
            analyticsService.track("create_deployment", { category: "deployments", label: "Create deployment in wizard", dseq: result.data.dseq });
            cacheDeployedSdl(deploymentLocalStorage, settingsId, result.data.dseq, sdl);
            router.replace(buildConfigureUrl(intentRef.current, result.data.dseq, bidStrategyRef.current), undefined, { shallow: true });
          },
          onError: function onCreateFailed(cause: unknown) {
            setError({ message: extractApiErrorMessage(cause) ?? undefined });
            setPhase("error");
          }
        }
      );
    },
    [createDeployment, router, deploymentLocalStorage, settingsId, analyticsService]
  );

  /** Drops the dseq from the URL immediately, not on close-success, so a returning user never sees the abandoned deployment while the close is in flight. */
  const cancelAndEdit = useCallback(
    function cancelAndEdit() {
      router.replace(buildConfigureUrl(intentRef.current, undefined, bidStrategy), undefined, { shallow: true });
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
  cancelAndEditRef.current = cancelAndEdit;

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

  const selectProvider = useCallback(
    function selectProvider(placementId: string, bidId: string) {
      setDeployError(undefined);
      setSelections(previous => ({ ...previous, [placementId]: bidId }));
      analyticsService.track("bid_selected", "Amplitude");
    },
    [analyticsService]
  );

  const clearSelection = useCallback(function clearSelection(placementId: string) {
    setSelections(function omitPlacement(previous) {
      const next = { ...previous };
      delete next[placementId];
      return next;
    });
  }, []);

  /**
   * The manifest is derived from the SDL being deployed (not the create-time one) so a quoting-window edit gets leased;
   * when it differs from create the deployment is updated first so the on-chain hash matches before the manifest is sent.
   */
  const deploy = useCallback(
    function deploy(sdl: string) {
      const nextManifest = dependencies.manifestFromSdl(sdl);
      if (!dseq || !nextManifest) return;
      const leases = Object.values(selections).map(parseBidId);
      if (leases.length === 0) return;
      const activeDseq = dseq;
      const activeManifest = nextManifest;
      const resources = dependencies.deploymentResourcesFromSdl(sdl);
      setDeployError(undefined);
      setDeploySucceeded(false);
      setPhase("deploying");
      /**
       * The onboarding gate reads "onboarded" off the leases cache, empty until this first deploy, so refreshing it
       * keeps a client-side nav to /deployments from bouncing the user back to onboarding until a full reload.
       */
      function completeDeploy(result: { data: { deployment: { id: { owner: string } } } }) {
        const owner = result.data.deployment.id.owner;
        analyticsService.track("create_lease", { category: "deployments", label: "Create lease", dseq: activeDseq, ...resources });
        if (resources.gpuAmount > 0) {
          analyticsService.track("create_gpu_deployment", { category: "deployments", label: "Create lease", dseq: activeDseq, ...resources });
        }
        analyticsService.track("send_manifest", { category: "deployments", label: "Send manifest after creating lease", dseq: activeDseq });
        cacheDeployedSdl(deploymentLocalStorage, owner, activeDseq, sdl);
        queryClient.invalidateQueries({ queryKey: QueryKeys.getAllLeasesKey(owner) });
        queryClient.invalidateQueries({ queryKey: QueryKeys.getDeploymentListKey(owner) });
        setDeploySucceeded(true);
        redirectTimerRef.current = setTimeout(function redirectToDeployment() {
          router.replace(UrlService.deploymentDetails(activeDseq, "EVENTS", "events"));
        }, DEPLOY_SUCCESS_DWELL_MS);
      }

      function failDeploy(cause: unknown) {
        setDeployError({ message: extractApiErrorMessage(cause) ?? undefined });
        setPhase("quoting");
      }

      function sendManifestAndLease() {
        createLease.mutate({ manifest: activeManifest, leases }, { onSuccess: completeDeploy, onError: failDeploy });
      }

      if (activeManifest !== manifest) {
        updateDeployment.mutate({ dseq: activeDseq, data: { sdl } }, { onSuccess: sendManifestAndLease, onError: failDeploy });
      } else {
        sendManifestAndLease();
      }
    },
    [createLease, updateDeployment, dseq, manifest, selections, router, dependencies, deploymentLocalStorage, queryClient, analyticsService]
  );

  return {
    phase,
    dseq,
    bidStrategy,
    selections,
    bids: bidsQuery.data?.data ?? [],
    deploySucceeded,
    deployError,
    error,
    actions: { requestQuotes, cancelAndEdit, setBidStrategy, refreshQuotes, retry, selectProvider, clearSelection, deploy }
  };
}

/** Best-effort cache under owner + dseq (the key the detail page reads); failures are swallowed so storage issues never block deploy. */
function cacheDeployedSdl(
  storage: ReturnType<typeof useServices>["deploymentLocalStorage"],
  owner: string | null | undefined,
  dseq: string,
  sdl: string
): void {
  try {
    storage.update(owner, dseq, { manifest: sdl });
  } catch {
    return;
  }
}

/** The provider manifest for an SDL, or null when it can't be built (invalid/mid-edit). Matches the server's create-deployment manifest, so the update-before-lease comparison in `deploy` holds. */
function manifestFromSdl(sdl: string): string | null {
  try {
    return ManifestYaml(sdl);
  } catch {
    return null;
  }
}

function deploymentResourcesFromSdl(sdl: string): { gpuAmount: number; cpuAmount: number; memoryAmount: number; storageAmount: number } {
  try {
    const totals = aggregateDeploymentResources(importSimpleSdl(sdl).services);
    return { gpuAmount: totals.gpu, cpuAmount: totals.cpu, memoryAmount: totals.memoryBytes, storageAmount: totals.ephemeralBytes + totals.persistentBytes };
  } catch {
    return { gpuAmount: 0, cpuAmount: 0, memoryAmount: 0, storageAmount: 0 };
  }
}

/** Builds the canonical configure URL preserving templateId/sdl-strategy/draftId/vm and the current dseq + bid-strategy. */
export function buildConfigureUrl(intent: DeploymentIntent, dseq: string | undefined, bidStrategy: BidStrategy): string {
  return UrlService.configureDeployment({
    dseq,
    templateId: intent.templateId,
    sdlStrategy: intent.templateId ? intent.sdlStrategy : undefined,
    bidStrategy,
    draftId: intent.draftId,
    vm: intent.vm
  });
}
