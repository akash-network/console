import { useCallback, useEffect, useRef, useState } from "react";
import { extractApiErrorCode, extractApiErrorMessage, isApiError } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { useRouter } from "next/router";

import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { QueryKeys } from "@src/queries/queryKeys";
import { BID_POLL_INTERVAL, useListBids } from "@src/queries/useListBids";
import { settingsIdAtom } from "@src/store/settingsStore";
import { formatBidId, parseBidId } from "@src/utils/bids/bidId";
import { ManifestYaml } from "@src/utils/deploymentData/helpers";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import type { SdlSecretValues, UnresolvedSdlSecret } from "@src/utils/sdl/sdlSecrets";
import { unresolvedSecretMessage } from "@src/utils/sdl/sdlSecrets";
import type { ServicesPatch } from "@src/utils/sdl/sdlServicesPatch";
import { isEmptyServicesPatch, servicesPatchBetween } from "@src/utils/sdl/sdlServicesPatch";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import { UrlService } from "@src/utils/urlUtils";
import { isWalletProvisioning, WALLET_PROVISIONING_ERROR_CODE, walletProvisioningRetry } from "@src/utils/walletProvisioning";
import { aggregateDeploymentResources } from "../DeploymentResourceSummary/deploymentResources";
import type { BidStrategy, DeploymentIntent } from "./deploymentIntent";

export type DeploymentFlowPhase = "configuring" | "creating" | "quoting" | "deploying" | "error";

/** A close still settling after a cancel; `failed` marks one verified still open, which the next create must close first. */
export type PendingClose = { dseq: string; failed: boolean; message?: string };

/** Which toast the form shows. A close failure reads differently from a failed quote request, and a refusal the user can pay their way out of needs an Add Funds action rather than an apology. */
export type FlowErrorKind = "create" | "close" | "no-providers" | "needs-funds" | "no-match" | "inherited-unreadable";

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
  error?: { message?: string; kind?: FlowErrorKind };
  /** The cancelled deployment closing in the background. Orthogonal to `phase`: the form stays editable throughout. */
  pendingClose: PendingClose | null;
}

export interface RequestQuotesOptions {
  name?: string;
  /** Typed secret values keyed by the name their SDL reference carries; sealed ahead of the create while the secrets feature is on. */
  secrets?: SdlSecretValues;
  /** A deployment of the user's whose stored secret values the new one starts from, sent while the secrets feature is on. */
  inheritSecretsFrom?: string;
}

export interface DeployOptions {
  /** Typed secret values keyed by the name their SDL reference carries; sealed into the pre-lease patch while the secrets feature is on. */
  secrets?: SdlSecretValues;
  /** Secrets the SDL references that nothing holds a value for, which the api could not resolve once the manifest is sent. */
  unresolvedSecrets?: UnresolvedSdlSecret[];
}

export interface DeploymentFlowActions {
  /** Creates the deployment from the given SDL. The caller passes the SDL generated from the just-submitted form
   * values so the request can never lag behind an in-flight edit. */
  requestQuotes: (sdl: string, options?: RequestQuotesOptions) => void;
  cancelAndEdit: () => void;
  /** Ends the attempt in `error` and closes the deployment so its deposit is released; a human uses `cancelAndEdit`. */
  closeAndFail: (message: string) => void;
  /** Re-closes a deployment a background close left open. No-op while a close is in flight. */
  retryClose: () => void;
  setBidStrategy: (strategy: BidStrategy) => void;
  refreshQuotes: () => void;
  retry: () => void;
  selectProvider: (placementId: string, bidId: string) => void;
  clearSelection: (placementId: string) => void;
  /** Creates the lease(s) and sends the manifest. The caller passes the current SDL so the manifest can be
   * rederived when it wasn't captured in this session (e.g. after a reload that resumed straight into quoting). */
  deploy: (sdl: string, options?: DeployOptions) => void;
}

export type DeploymentFlow = DeploymentFlowState & { actions: DeploymentFlowActions };

interface UseDeploymentFlowInput {
  intent: DeploymentIntent;
}

/** Default escrow deposit in USD (ACT maps 1:1 to USD). Matches `DEFAULT_DEPOSIT_USD` in the phased flow so a trial grant covers it. */
const DEFAULT_DEPOSIT = 0.5;

const HTTP_PAYMENT_REQUIRED = 402;

/** A seal made to a key version the console no longer holds; a fresh context and a new seal is the remedy. */
const HTTP_CONFLICT = 409;

/** The api's code for a source deployment whose stored secrets can no longer be decrypted, which no retry can help. */
const INHERITED_SECRETS_UNREADABLE_CODE = "inherited_secrets_unreadable";

/** Hold after a successful lease so the deploy overlay's progress bar can fill to 100% and its final step turn green before redirecting. */
const DEPLOY_SUCCESS_DWELL_MS = 1200;

/**
 * Wait this long for a first bid before failing fast — some specs never draw one (niche resources, tight filters, a
 * quiet marketplace), and the full ~5-minute quote window only makes sense once bids exist. Resets when any bid lands.
 */
const NO_BIDS_TIMEOUT_MS = 60 * 1000;

/** Error surfaced when a deployment draws no provider bids at all within {@link NO_BIDS_TIMEOUT_MS}. */
const NO_PROVIDERS_MESSAGE = "No providers are available for this deployment right now. Try adjusting your deployment and requesting quotes again.";

/** An `active` bid is one this deployment already holds the lease on — exactly what a resumed selection points at. */
const LIVE_BID_STATES = new Set(["open", "active"]);

/** Surfaced when the SDL on screen can't be turned into a provider manifest at deploy time. */
const MANIFEST_BUILD_MESSAGE = "We couldn't prepare this deployment's manifest. Check your SDL and try again.";

/** Surfaced when deploy is reached with nothing selected — the manual CTA is disabled for that, an autopilot is not. */
const NO_SELECTION_MESSAGE = "No provider is selected for this deployment.";

/** Surfaced when the create-deployment retry budget is exhausted while the trial wallet is still provisioning server-side. */
const WALLET_PROVISIONING_TIMEOUT_MESSAGE =
  "Your account is still being set up. Please try again in a few minutes, or contact support if this keeps happening.";

export const DEPENDENCIES = {
  useServices,
  useListBids,
  useRouter,
  useQueryClient,
  useFlag,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  manifestFromSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  deploymentResourcesFromSdl,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  servicesPatchBetween
};

/**
 * Controlled lifecycle state machine for the configure flow. Owns interaction state (phase, dseq,
 * bidStrategy) and mirrors dseq/bid-strategy to the URL; server state (screened providers, bids)
 * lives in react-query via `usePlacementOffers`. Resumes in `quoting` when the URL already carries
 * a dseq, so a reload picks up live bids rather than restarting.
 */
export function useDeploymentFlow({ intent }: UseDeploymentFlowInput, dependencies: typeof DEPENDENCIES = DEPENDENCIES): DeploymentFlow {
  const { api, deploymentLocalStorage, analyticsService } = dependencies.useServices();
  const router = dependencies.useRouter();
  const createDeployment = api.v1.createDeployment.useMutation(walletProvisioningRetry);
  const closeDeployment = api.v1.closeDeployment.useMutation();
  const createLease = api.v1.createLease.useMutation();
  const updateDeployment = api.v1.updateDeployment.useMutation();
  const patchDeployment = api.v1.patchDeployment.useMutation();
  const getDeployment = api.v1.getDeployment.useMutation();
  const getSdlSecretsContext = api.v1.getSDLSecretsContext.useMutation();
  const isSecretsEnabled = dependencies.useFlag("ui_deployment_secrets");
  const queryClient = dependencies.useQueryClient();
  const settingsId = useAtomValue(settingsIdAtom);

  const [phase, setPhase] = useState<DeploymentFlowPhase>(intent.dseq ? "quoting" : "configuring");
  const [dseq, setDseq] = useState<string | null>(intent.dseq ?? null);
  const [bidStrategy, setBidStrategyState] = useState<BidStrategy>(intent.bidStrategy);
  const [error, setError] = useState<{ message?: string; kind?: FlowErrorKind } | undefined>(undefined);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [manifest, setManifest] = useState<string | null>(null);
  /** The SDL the create sent, which a quoting-window edit is diffed against; null on a session that never saw the create. */
  const [createdSdl, setCreatedSdl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<{ message?: string } | undefined>(undefined);
  const [deploySucceeded, setDeploySucceeded] = useState(false);
  const [pendingClose, setPendingClose] = useState<PendingClose | null>(null);

  const intentRef = useRef(intent);
  intentRef.current = intent;

  /** Read in the async create-success callback so a create resolving after a strategy switch uses the current value. */
  const bidStrategyRef = useRef(bidStrategy);
  bidStrategyRef.current = bidStrategy;

  /**
   * Bumped on every requestQuotes and every cancel, so any create from a superseded attempt is treated as stale: one
   * not yet started (still behind a pre-create close) is skipped in `create()`, and one already in flight has its late
   * success auto-close the just-created deployment instead of resuming.
   */
  const createAttemptRef = useRef(0);

  /** The dseq of the close in flight. Read synchronously so a create can never overlap one and open a second deployment. */
  const closingDseqRef = useRef<string | null>(null);

  /** The create waiting on that close, run once the deployment is verified gone and dropped when it is not. */
  const queuedCreateRef = useRef<(() => void) | null>(null);

  /** Pins a close's outcome to the close that started it, so a superseded one can never settle a newer session. */
  const closeTokenRef = useRef(0);

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
      const liveBidIds = new Set(bids.filter(entry => LIVE_BID_STATES.has(entry.bid.state)).map(entry => formatBidId(entry.bid.id)));
      setSelections(function dropDeadSelections(previous) {
        const survivors = Object.entries(previous).filter(([, bidId]) => liveBidIds.has(bidId));
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
            setError({ message: NO_PROVIDERS_MESSAGE, kind: "no-providers" });
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

  /** Everything tied to the deployment that just went away. The caller decides where the flow lands afterwards. */
  const clearDeploymentState = useCallback(function clearDeploymentState() {
    setDseq(null);
    setSelections({});
    setManifest(null);
    setCreatedSdl(null);
    setDeployError(undefined);
    setDeploySucceeded(false);
  }, []);

  /** Leaves `pendingClose` alone, because the close it tracks outlives the reset that hands the form back. */
  const resetToConfiguring = useCallback(
    function resetToConfiguring() {
      clearDeploymentState();
      setError(undefined);
      setPhase("configuring");
    },
    [clearDeploymentState]
  );

  /** Guarded on the settings id because `getBalancesKey(undefined)` is the empty key, which would invalidate every query. */
  const invalidateClosedDeploymentCaches = useCallback(
    function invalidateClosedDeploymentCaches() {
      if (!settingsId) return;
      queryClient.invalidateQueries({ queryKey: QueryKeys.getBalancesKey(settingsId) });
      queryClient.invalidateQueries({ queryKey: QueryKeys.getDeploymentListKey(settingsId) });
      queryClient.invalidateQueries({ queryKey: api.v1.listDeployments.getKey() });
    },
    [queryClient, settingsId, api]
  );

  /** A failure only becomes an error scene when a create was queued behind it, so a purely background one leaves the phase alone. */
  const settleClose = useCallback(
    function settleClose(closedDseq: string, token: number, verifiedClosed: boolean, cause?: unknown) {
      if (token !== closeTokenRef.current) return;
      closingDseqRef.current = null;
      const queuedCreate = queuedCreateRef.current;
      queuedCreateRef.current = null;

      if (verifiedClosed) {
        setPendingClose(null);
        invalidateClosedDeploymentCaches();
        queuedCreate?.();
        return;
      }

      const message = extractApiErrorMessage(cause) ?? undefined;
      setPendingClose({ dseq: closedDseq, failed: true, message });
      if (!queuedCreate) return;
      setError({ message, kind: "close" });
      setPhase("error");
    },
    [invalidateClosedDeploymentCaches]
  );

  /**
   * tx-signer stops polling (~36s) only after the tx TTL (30s) expires, so a reported failure is often a false negative
   * and one live read is decisive. `token` must not be the create-attempt counter: a re-quote after the cancel would bump
   * that counter and drop the very outcome the queued create waits on.
   */
  const verifyCloseOutcome = useCallback(
    function verifyCloseOutcome(dseqToVerify: string, token: number, cause: unknown) {
      function settle(verifiedClosed: boolean) {
        if (token !== closeTokenRef.current) return;
        analyticsService.track("close_deployment_failed", { category: "deployments", dseq: dseqToVerify, verifiedClosed });
        settleClose(dseqToVerify, token, verifiedClosed, cause);
      }
      getDeployment.mutate(
        { dseq: dseqToVerify },
        {
          onSuccess: function onVerified(result: { data: { deployment: { state: string } } }) {
            settle(result.data.deployment.state === "closed");
          },
          onError: function onVerifyFailed(verifyError: unknown) {
            settle(isApiError(verifyError) && verifyError.status === 404);
          }
        }
      );
    },
    [getDeployment, analyticsService, settleClose]
  );

  /** The only close path, so one mutex and one queue cover both a cancel's background close and a pre-create close. */
  const startClose = useCallback(
    function startClose(dseqToClose: string) {
      const token = ++closeTokenRef.current;
      closingDseqRef.current = dseqToClose;
      setPendingClose({ dseq: dseqToClose, failed: false });
      closeDeployment.mutate(
        { dseq: dseqToClose },
        {
          onSuccess: function onClosed() {
            settleClose(dseqToClose, token, true);
          },
          onError: function onCloseFailed(cause: unknown) {
            verifyCloseOutcome(dseqToClose, token, cause);
          }
        }
      );
    },
    [closeDeployment, settleClose, verifyCloseOutcome]
  );

  /** A deployment this session opened that is known to be still open with no close in flight: the next create closes it first. */
  const strandedDseq = pendingClose?.failed ? pendingClose.dseq : null;

  /** Seals against the console's current key; a create binds the seal to its SDL, a patch binds to none because the api checks it against the stored document. */
  const sealSecrets = useCallback(
    async function sealSecrets(secrets: SdlSecretValues, sdl?: string): Promise<string> {
      const context = await getSdlSecretsContext.mutateAsync();
      return await dependencies.sealSdlSecrets({ context: context.data, secrets, ...(sdl === undefined ? {} : { sdl }) });
    },
    [getSdlSecretsContext, dependencies]
  );

  /**
   * Caches the SDL under the settings id + dseq at create time (the create response omits `owner`) so an in-progress
   * deployment can resume after a reload. A still-open deployment is closed first and a create fired mid-close waits on
   * it rather than racing it, so only one deployment is ever open. With the secrets feature on, the typed values are
   * sealed to the console's current key first, and a seal the api reports stale is remade once against a fresh key.
   */
  const requestQuotes = useCallback(
    function requestQuotes(sdl: string, options: RequestQuotesOptions = {}) {
      const attempt = ++createAttemptRef.current;
      providersEverBidRef.current = false;
      bidsReceivedTrackedRef.current = false;
      setError(undefined);
      const secrets = options.secrets ?? {};

      function isCurrentAttempt() {
        return attempt === createAttemptRef.current;
      }

      function onCreated(result: { data: { dseq: string; manifest: string } }) {
        if (!isCurrentAttempt()) {
          closeDeployment.mutate(
            { dseq: result.data.dseq },
            {
              onError: function trackAutoCloseFailure() {
                analyticsService.track("cancelled_deployment_auto_close_failed", { category: "deployments", dseq: result.data.dseq });
              }
            }
          );
          return;
        }
        setDseq(result.data.dseq);
        setManifest(result.data.manifest);
        setCreatedSdl(sdl);
        setSelections({});
        setDeployError(undefined);
        setDeploySucceeded(false);
        setPhase("quoting");
        analyticsService.track("create_deployment", {
          category: "deployments",
          label: "Create deployment in wizard",
          dseq: result.data.dseq,
          secretCount: Object.keys(secrets).length
        });
        cacheDeployedSdl(deploymentLocalStorage, settingsId, result.data.dseq, sdl);
        router.replace(buildConfigureUrl(intentRef.current, result.data.dseq, bidStrategyRef.current), undefined, { shallow: true });
      }

      function onCreateFailed(cause: unknown) {
        if (!isCurrentAttempt()) return;
        const message =
          extractApiErrorCode(cause) === WALLET_PROVISIONING_ERROR_CODE ? WALLET_PROVISIONING_TIMEOUT_MESSAGE : extractApiErrorMessage(cause) ?? undefined;
        setError({ message, kind: isPaymentRequired(cause) ? "needs-funds" : "create" });
        setPhase("error");
      }

      const inheritance = isSecretsEnabled && options.inheritSecretsFrom ? { inheritSecretsFrom: options.inheritSecretsFrom } : {};

      function submitCreate(sealed: { sealedSecrets?: string }, canResealOnce: boolean) {
        createDeployment.mutate(
          { data: { sdl, ...namePayload(options.name), ...sealed, ...inheritance, deposit: DEFAULT_DEPOSIT } },
          {
            onSuccess: onCreated,
            onError: function retryOrFail(cause: unknown) {
              if (!isCurrentAttempt()) return;
              if (isInheritedSecretsUnreadable(cause)) {
                setError({ message: extractApiErrorMessage(cause) ?? undefined, kind: "inherited-unreadable" });
                setPhase("error");
                return;
              }
              if (canResealOnce && isStaleSealingKey(cause)) {
                void sealAndSubmit(false);
                return;
              }
              onCreateFailed(cause);
            }
          }
        );
      }

      async function sealAndSubmit(canResealOnce: boolean) {
        let sealedSecrets: string;
        try {
          sealedSecrets = await sealSecrets(secrets, sdl);
        } catch (cause) {
          onCreateFailed(cause);
          return;
        }
        if (!isCurrentAttempt()) return;
        submitCreate({ sealedSecrets }, canResealOnce);
      }

      function create() {
        if (!isCurrentAttempt()) return;
        setPhase("creating");
        if (isSecretsEnabled) {
          void sealAndSubmit(true);
          return;
        }
        submitCreate({}, false);
      }

      const openDseq = dseq ?? strandedDseq;
      if (openDseq) {
        setPhase("creating");
        setDseq(null);
        queuedCreateRef.current = create;
        startClose(openDseq);
        return;
      }

      if (closingDseqRef.current) {
        setPhase("creating");
        queuedCreateRef.current = create;
        return;
      }

      create();
    },
    [
      createDeployment,
      closeDeployment,
      sealSecrets,
      isSecretsEnabled,
      dseq,
      strandedDseq,
      router,
      deploymentLocalStorage,
      settingsId,
      analyticsService,
      startClose
    ]
  );

  /**
   * The dseq leaves the URL on the same tick, so a returning user never sees the abandoned deployment. Falls back to
   * `strandedDseq` rather than any pending dseq so a second press cannot broadcast a duplicate close for one settling.
   */
  const cancelAndEdit = useCallback(
    function cancelAndEdit() {
      router.replace(buildConfigureUrl(intentRef.current, undefined, bidStrategy), undefined, { shallow: true });
      createAttemptRef.current += 1;
      queuedCreateRef.current = null;
      const dseqToClose = dseq ?? strandedDseq;
      const isCreateOutstanding = phase === "creating" && !closingDseqRef.current;
      if (!dseqToClose && isCreateOutstanding) analyticsService.track("cancel_during_create", { category: "deployments" });
      resetToConfiguring();
      if (dseqToClose) startClose(dseqToClose);
    },
    [dseq, strandedDseq, phase, router, bidStrategy, analyticsService, resetToConfiguring, startClose]
  );
  /**
   * Lands in `error`, never `configuring`: the auto flow creates a fresh deployment the instant it reads `configuring`.
   * Clearing the dseq up front is what stops a retry in the close's window from broadcasting a second one, since every
   * other close path falls back to `strandedDseq`, which only names a deployment whose close already came back open.
   */
  const closeAndFail = useCallback(
    function closeAndFail(message: string) {
      createAttemptRef.current += 1;
      queuedCreateRef.current = null;
      router.replace(buildConfigureUrl(intentRef.current, undefined, bidStrategyRef.current), undefined, { shallow: true });
      const dseqToClose = dseq ?? strandedDseq;
      clearDeploymentState();
      setError({ message, kind: "no-match" });
      setPhase("error");
      if (dseqToClose) startClose(dseqToClose);
    },
    [dseq, strandedDseq, router, clearDeploymentState, startClose]
  );

  cancelAndEditRef.current = cancelAndEdit;

  const retryClose = useCallback(
    function retryClose() {
      if (!strandedDseq) return;
      startClose(strandedDseq);
    },
    [strandedDseq, startClose]
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
   * With the secrets feature on, that update is a patch of what changed since the create, because the whole-SDL update
   * seals every value and cannot resolve a reference.
   */
  const deploy = useCallback(
    function deploy(sdl: string, options: DeployOptions = {}) {
      if (!dseq) return;
      const nextManifest = dependencies.manifestFromSdl(sdl);
      const leases = Object.values(selections).map(parseBidId);
      if (!nextManifest) {
        setDeployError({ message: MANIFEST_BUILD_MESSAGE });
        return;
      }
      if (leases.length === 0) {
        setDeployError({ message: NO_SELECTION_MESSAGE });
        return;
      }
      /** A kept reference may already be sealed against this deployment, which only the api can confirm; a name this form minted is held by nothing. */
      const mintedWithoutValue = (options.unresolvedSecrets ?? []).filter(secret => !secret.isKeptReference);
      if (mintedWithoutValue.length > 0) {
        setDeployError({ message: mintedWithoutValue.map(unresolvedSecretMessage).join(" ") });
        return;
      }
      const activeDseq = dseq;
      const activeManifest = nextManifest;
      /** A corrected secret leaves the SDL untouched, because its reference is what the SDL carries, so an unchanged manifest still has to patch. */
      const hasTypedSecrets = Object.keys(options.secrets ?? {}).length > 0;
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
        queryClient.invalidateQueries({ queryKey: QueryKeys.getLeaseExistenceKey(owner) });
        queryClient.invalidateQueries({ queryKey: QueryKeys.getAllLeasesKey(owner) });
        queryClient.invalidateQueries({ queryKey: QueryKeys.getDeploymentListKey(owner) });
        queryClient.invalidateQueries({ queryKey: api.v1.listDeployments.getKey() });
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

      function updateWholeSdlAndLease() {
        updateDeployment.mutate({ dseq: activeDseq, data: { sdl } }, { onSuccess: sendManifestAndLease, onError: failDeploy });
      }

      function submitPatch(services: ServicesPatch | undefined, sealedSecrets: string | undefined, canResealOnce: boolean) {
        patchDeployment.mutate(
          { dseq: activeDseq, data: { ...(services === undefined ? {} : { services }), ...(sealedSecrets === undefined ? {} : { sealedSecrets }) } },
          {
            onSuccess: sendManifestAndLease,
            onError: function resealOrFail(cause: unknown) {
              if (canResealOnce && isStaleSealingKey(cause)) {
                void sealAndPatch(services, false);
                return;
              }
              failDeploy(cause);
            }
          }
        );
      }

      async function sealAndPatch(services: ServicesPatch | undefined, canResealOnce: boolean) {
        try {
          submitPatch(services, await sealSecrets(options.secrets ?? {}), canResealOnce);
        } catch (cause) {
          failDeploy(cause);
        }
      }

      /** A session that never saw the create diffs against the stored definition; with none to diff against, the whole SDL goes out as before. */
      async function patchChangesAndLease() {
        let services: ServicesPatch | undefined;
        try {
          const baselineSdl = createdSdl ?? (await storedSdlOf(activeDseq));
          if (baselineSdl === null) {
            updateWholeSdlAndLease();
            return;
          }
          const patched = dependencies.servicesPatchBetween(baselineSdl, sdl);
          services = isEmptyServicesPatch(patched) ? undefined : patched;
        } catch (cause) {
          failDeploy(cause);
          return;
        }

        if (services === undefined && !hasTypedSecrets) {
          sendManifestAndLease();
        } else if (hasTypedSecrets) {
          await sealAndPatch(services, true);
        } else {
          submitPatch(services, undefined, false);
        }
      }

      async function storedSdlOf(dseqToRead: string): Promise<string | null> {
        const result = await getDeployment.mutateAsync({ dseq: dseqToRead });
        return result.data.consoleSettings?.sdl ?? null;
      }

      if (activeManifest === manifest && !hasTypedSecrets) {
        sendManifestAndLease();
      } else if (isSecretsEnabled) {
        void patchChangesAndLease();
      } else {
        updateWholeSdlAndLease();
      }
    },
    [
      createLease,
      updateDeployment,
      patchDeployment,
      getDeployment,
      sealSecrets,
      isSecretsEnabled,
      createdSdl,
      dseq,
      manifest,
      selections,
      router,
      dependencies,
      deploymentLocalStorage,
      queryClient,
      analyticsService
    ]
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
    pendingClose,
    actions: { requestQuotes, cancelAndEdit, closeAndFail, retryClose, setBidStrategy, refreshQuotes, retry, selectProvider, clearSelection, deploy }
  };
}

/** The api refuses a blank name rather than reading it as "unnamed", so a name the user left empty is left out of the request entirely. */
function namePayload(name: string | undefined): { name?: string } {
  const trimmed = name?.trim();
  return trimmed ? { name: trimmed } : {};
}

/** Status is the only signal available: a refused deposit, an exhausted fee allowance and a trial-blocked GPU all report `payment_required`. */
function isPaymentRequired(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_PAYMENT_REQUIRED;
}

/** A seal made against a retired key comes back as a bare 409; a wallet still provisioning answers 409 too and has its own retry. */
function isStaleSealingKey(cause: unknown): boolean {
  return isApiError(cause) && cause.status === HTTP_CONFLICT && !isWalletProvisioning(cause) && !isInheritedSecretsUnreadable(cause);
}

function isInheritedSecretsUnreadable(cause: unknown): boolean {
  return extractApiErrorCode(cause) === INHERITED_SECRETS_UNREADABLE_CODE;
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

/** Builds the canonical configure URL preserving both template ids, sdl-strategy, draftId and vm alongside the current dseq + bid-strategy. */
export function buildConfigureUrl(intent: DeploymentIntent, dseq: string | undefined, bidStrategy: BidStrategy): string {
  return UrlService.configureDeployment({
    dseq,
    templateId: intent.templateId,
    userTemplateId: intent.userTemplateId,
    sdlStrategy: intent.templateId ? intent.sdlStrategy : undefined,
    bidStrategy,
    draftId: intent.draftId,
    vm: intent.vm
  });
}
