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
import { UrlService } from "@src/utils/urlUtils";
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
 * How long to wait for a *first* bid before giving up on a freshly quoted deployment. Some specs never draw a
 * single bid (niche resources, tight region filters, or a quiet marketplace); rather than leave the user staring
 * at "Requesting…" for the full ~5-minute bid window that only makes sense once bids exist, fail fast when none
 * arrive at all. Reset the instant any open bid lands — from then on the normal quote-expiry window governs.
 */
const NO_BIDS_TIMEOUT_MS = 60 * 1000;

/** Error surfaced when a deployment draws no provider bids at all within {@link NO_BIDS_TIMEOUT_MS}. */
const NO_PROVIDERS_MESSAGE = "No providers are available for this deployment right now. Try adjusting your deployment and requesting quotes again.";

function useCloseDeployment() {
  return useServices().api.v1.closeDeployment.useMutation();
}

function useCreateLease() {
  return useServices().api.v1.createLease.useMutation();
}

function useUpdateDeployment() {
  return useServices().api.v1.updateDeployment.useMutation();
}

function useDeploymentLocalStorage() {
  return useServices().deploymentLocalStorage;
}

/** The wallet address that keys deployment-local storage (WalletProvider sets it to the wallet address); same key the detail page reads. */
function useSettingsId() {
  return useAtomValue(settingsIdAtom);
}

export const DEPENDENCIES = {
  useCreateDeployment,
  useCloseDeployment,
  useCreateLease,
  useUpdateDeployment,
  useListBids,
  useRouter,
  useQueryClient,
  useDeploymentLocalStorage,
  useSettingsId,
  manifestFromSdl
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
  const router = dependencies.useRouter();
  const createDeployment = dependencies.useCreateDeployment({ isWalletReady, trialError });
  const closeDeployment = dependencies.useCloseDeployment();
  const createLease = dependencies.useCreateLease();
  const updateDeployment = dependencies.useUpdateDeployment();
  const queryClient = dependencies.useQueryClient();
  const deploymentLocalStorage = dependencies.useDeploymentLocalStorage();
  const settingsId = dependencies.useSettingsId();

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

  // Always-current bid strategy for the async create-success callback below. The auto autopilot fires the create as
  // "auto", but the user can switch to "select" ("Choose my provider") while it's still in flight; reading the ref
  // keeps the create-success URL on whatever strategy is current, so a late create doesn't bounce the user back to the
  // auto page after they've moved to the manual one.
  const bidStrategyRef = useRef(bidStrategy);
  bidStrategyRef.current = bidStrategy;

  // Latest `cancelAndEdit` for the no-providers timeout to call. It closes over `dseq`/`bidStrategy` and the per-render
  // close mutation, so it can't be a stable effect dependency — a ref lets the timeout reach the current one without
  // re-arming (and thus resetting) the timer on every render, which would keep it from ever firing.
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

  // Latches true once this deployment has drawn any open bid. Makes the no-providers timeout one-shot: after providers
  // have bid, their later disappearance (e.g. quotes expiring) must not re-arm it — that's the quote-expiry path, not a
  // "no providers" failure. Reset per deployment when a fresh quote request starts (see `requestQuotes`).
  const providersEverBidRef = useRef(false);

  useEffect(
    function failWhenNoProvidersBid() {
      if (hasOpenBids) providersEverBidRef.current = true;
      // Arm only while quoting with nothing shown and no bid ever seen; once a bid has appeared it never re-arms.
      if (phase !== "quoting" || providersEverBidRef.current) return;
      const timer = setTimeout(function timeOutWithoutProviders() {
        // Only the auto-deploy experience autopilots over this shared flow. That autopilot re-fires a create whenever
        // the flow lands back in `configuring` and reads its error scene off `phase === "error"` (not `error`), so there
        // we must halt in `error` — its "Try again"/"Choose my provider" drive the next step. The manual flow has no
        // autopilot: close the now-dangling deployment and drop back to editing. Either way set the message last so it
        // survives `cancelAndEdit`'s own `setError(undefined)` (same batch, last write wins) and the error toast fires.
        if (intentRef.current.sdlStrategy === "default" && bidStrategyRef.current === "auto") {
          setError({ message: NO_PROVIDERS_MESSAGE });
          setPhase("error");
          return;
        }
        cancelAndEditRef.current?.();
        setError({ message: NO_PROVIDERS_MESSAGE });
      }, NO_BIDS_TIMEOUT_MS);
      return function cancelNoProvidersTimeout() {
        clearTimeout(timer);
      };
    },
    [phase, hasOpenBids]
  );

  const requestQuotes = useCallback(
    function requestQuotes(sdl: string) {
      // A fresh deployment reopens the no-providers window: re-arm the one-shot timeout for the new quoting session.
      providersEverBidRef.current = false;
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
            // Cache the SDL under the wallet + dseq key the detail page reads, at create time, so an in-progress
            // deployment (on-chain, no lease yet) can be resumed into the configure flow after a reload, when the
            // captured SDL is otherwise gone. The create response omits `owner`, so key off the settings id.
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
    [createDeployment, router, deploymentLocalStorage, settingsId]
  );

  const cancelAndEdit = useCallback(
    function cancelAndEdit() {
      // Drop the dseq from the URL immediately — not on close-success — so returning to editing (and the auto flow's
      // "Try again") never leaves the abandoned deployment in the address bar while the close request is in flight.
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
   * Deploys the current selections. The manifest is always derived from the SDL being deployed, so a
   * quoting-window edit is what gets leased — never a stale create-time manifest. When that manifest differs
   * from the one captured at create — or none was captured, e.g. a reload that resumed straight into
   * `quoting` — the deployment is updated first (MsgUpdateDeployment) so the on-chain manifest hash matches
   * before the provider is sent the manifest at lease time; an unchanged manifest goes straight to the lease.
   * On success it persists the SDL under the deployment's dseq keyed by the owner the response carries (so it
   * needs no wallet) — the same key the detail page reads — then replaces the configure entry with the
   * deployment's events tab (matching the legacy builder), so Back lands on the new-deployment page rather than
   * the just-deployed config.
   * On any failure it drops back to `quoting` (unmounting the overlay) and sets `deployError` to drive the
   * error toast and the header's Retry CTA; retry re-fires with the current selections. Provider re-selection
   * after a lease exists is out of scope here.
   */
  const deploy = useCallback(
    function deploy(sdl: string) {
      const nextManifest = dependencies.manifestFromSdl(sdl);
      if (!dseq || !nextManifest) return;
      const leases = Object.values(selections).map(parseBidId);
      if (leases.length === 0) return;
      const activeDseq = dseq;
      const activeManifest = nextManifest;
      setDeployError(undefined);
      setDeploySucceeded(false);
      setPhase("deploying");
      function completeDeploy(result: { data: { deployment: { id: { owner: string } } } }) {
        const owner = result.data.deployment.id.owner;
        cacheDeployedSdl(deploymentLocalStorage, owner, activeDseq, sdl);
        // The onboarding gate decides "onboarded" from the leases cache, which was populated empty before this
        // first deploy. Refresh it (and the deployment list) so a client-side nav to /deployments doesn't read a
        // stale empty cache and bounce the user back to onboarding until a full page reload.
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
    [createLease, updateDeployment, dseq, manifest, selections, router, dependencies, deploymentLocalStorage, queryClient]
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

/**
 * Best-effort cache of the deployed SDL under the deployment's owner + dseq — the key the detail page reads.
 * Storage can be blocked, full, or hold corrupt data, so any failure is swallowed: caching must never keep the
 * deploy-success UI or the redirect from running.
 */
function cacheDeployedSdl(storage: ReturnType<typeof useDeploymentLocalStorage>, owner: string | null | undefined, dseq: string, sdl: string): void {
  try {
    storage.update(owner, dseq, { manifest: sdl });
  } catch {
    return;
  }
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
