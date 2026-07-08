import { useEffect, useMemo, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";

import type { BidStrategy, DeploymentIntent } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/deploymentIntent";
import type { DeploymentFlowPhase } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useDeploymentFlow } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useServices } from "@src/context/ServicesProvider";
import { usePhasedProgressBar } from "@src/hooks/useGradualProgress/usePhasedProgressBar";
import type { DeployPhase, DeployPhaseId, DeployProgressState } from "@src/hooks/usePhasedDeploymentFlow/deployPhases";
import { buildDeployPhases, PHASE_MARKERS, PHASE_ORDER, PHASE_TIME_CONSTANTS } from "@src/hooks/usePhasedDeploymentFlow/deployPhases";
import { useFirstReachableProvider, useProviderList } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId, parseBidId } from "@src/utils/bids/bidId";

type Options = {
  sdl: string;
  /**
   * Whether the trial wallet is initialized server-side and ready to broadcast deployments. While `false`, the
   * autopilot holds off on firing the create action — the user keeps seeing "Creating deployment" while the trial
   * spins up behind the scenes. Required so callers can't accidentally stall the flow by omitting the readiness signal.
   */
  isWalletReady: boolean;
  /** If the trial-start mutation has terminally errored, the flow projects to the error state instead of waiting forever. */
  trialError?: unknown;
  /**
   * A deployment's dseq carried in from the URL on a resumed session (a reload of the progress view). When present the
   * underlying flow resumes in `quoting` — the deployment already exists on chain — and the autopilot jumps straight
   * to the lease when an active lease is already found for it. Absent on a fresh start.
   */
  initialDseq?: string;
  /** The template the flow deploys, mirrored into the intent so URL resume preserves it. */
  templateId?: string;
  /** The active configure draft id, mirrored into the intent so a reload resolves the same session. */
  draftId?: string;
};

type Result = {
  state: DeployProgressState;
  progressPercent: number;
  phases: [DeployPhase, DeployPhase, DeployPhase];
  matchedProviderAddress: string | null;
  retry: () => void;
  startOver: () => void;
};

/** Poll cadence for `listBids`/reachability probing while we wait for the first reachable bid. */
const BID_POLL_INTERVAL = 2000;

/** The four coordinates that identify a lease/bid. */
type LeaseId = { dseq: string; gseq: number; oseq: number; provider: string };

export const DEPENDENCIES = {
  useDeploymentFlow,
  useProviderList,
  useFirstReachableProvider
};

/**
 * Autopilot + progress projection over {@link useDeploymentFlow}. There is exactly one real state machine — the
 * manual configure flow — and this hook drives it automatically for the auto-deploy (animated globe) experience:
 * it fires `requestQuotes` once the trial wallet is ready, watches live bids for the first *reachable* provider,
 * records that provider as the flow's selection, then fires `deploy`. The underlying flow owns URL resume,
 * multi-lease, the pre-lease `updateDeployment` reconcile, SDL caching, and the deploy-success redirect — the auto
 * flow inherits all of it for free.
 *
 * On top of the flow it keeps the auto-only concerns: reachability selection (`listBids` + `useProviderList` +
 * `useFirstReachableProvider`), trial gating, the resume-after-lease pre-check (reconstructing the selection from an
 * existing active lease so the idempotent server create-lease completes), the phased progress-bar animation, and the
 * matched-provider address. `flow.phase` is projected onto the three-step create → match → prepare progress UI.
 */
export function usePhasedDeploymentFlow(
  { sdl, isWalletReady, trialError, initialDseq, templateId, draftId }: Options,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): Result {
  const { api } = useServices();

  const intentRef = useRef<DeploymentIntent>({
    sdlStrategy: "default",
    bidStrategy: "auto" as BidStrategy,
    dseq: initialDseq,
    templateId,
    draftId
  });

  const flow = dependencies.useDeploymentFlow({ intent: intentRef.current });

  const sdlRef = useRef(sdl);
  sdlRef.current = sdl;

  // The dseq a resumed session mounted with, read from the mount-pinned intent: only a genuine reload — mounted with a
  // dseq — resumes. The dseq later written to the URL after a fresh create lives on `flow.dseq`, not here, so it can't
  // retroactively flip a fresh start into resume mode.
  const resumedDseq = intentRef.current.dseq;

  const [retryToken, setRetryToken] = useState(0);

  // One-shot guards so a re-render can't re-fire an action that's already in flight for the current attempt.
  const createFiredRef = useRef(false);
  const selectFiredRef = useRef(false);
  const deployFiredRef = useRef(false);

  const dseq = flow.dseq;

  // On a resumed session the deployment may already have a lease. Fetch it so we can reconstruct the selection and let
  // the idempotent server create-lease finish, skipping the bid match entirely. Disabled on a fresh start.
  const deploymentQuery = api.v1.getDeployment.useQuery(
    { dseq: dseq ?? "" },
    { enabled: !!resumedDseq && !!dseq && flow.phase === "quoting" && isWalletReady }
  );
  const existingActiveLease = deploymentQuery.data?.data.leases.find(lease => lease.state !== "closed");
  /** On a resume we must know whether a lease already exists before matching from bids; a fresh start needs no such wait. */
  const resumeLeaseChecked = !resumedDseq || deploymentQuery.isFetched;

  const bidsQuery = api.v1.listBids.useQuery(
    { dseq: dseq ?? "" },
    { enabled: flow.phase === "quoting" && !!dseq, refetchInterval: BID_POLL_INTERVAL }
  );
  const openBids = flow.phase === "quoting" ? bidsQuery.data?.data.filter(bid => bid.bid.state === "open") ?? [] : [];

  const { data: providers } = dependencies.useProviderList({ enabled: flow.phase === "quoting" });
  const candidateProviders = openBids
    .map(bid => providers?.find(provider => provider.owner === bid.bid.id.provider))
    .filter((provider): provider is ApiProviderList => !!provider);

  const reachableProviderQuery = dependencies.useFirstReachableProvider(candidateProviders, {
    enabled: flow.phase === "quoting" && candidateProviders.length > 0,
    refetchInterval: BID_POLL_INTERVAL
  });
  const reachableProvider = reachableProviderQuery.data;
  const activeBid = reachableProvider ? openBids.find(bid => bid.bid.id.provider === reachableProvider.owner) : undefined;

  // The lease/bid to record as the flow's selection: an already-existing active lease on a resume takes precedence;
  // otherwise the first reachable open bid, held until the resume lease-check has settled so a fresh match never races
  // an existing lease. Null until there's something to select.
  const selectionTarget = useMemo<LeaseId | null>(() => {
    if (existingActiveLease) {
      return { dseq: existingActiveLease.id.dseq, gseq: existingActiveLease.id.gseq, oseq: existingActiveLease.id.oseq, provider: existingActiveLease.id.provider };
    }
    if (resumeLeaseChecked && activeBid) {
      return { dseq: activeBid.bid.id.dseq, gseq: activeBid.bid.id.gseq, oseq: activeBid.bid.id.oseq, provider: activeBid.bid.id.provider };
    }
    return null;
  }, [existingActiveLease, resumeLeaseChecked, activeBid]);

  // Reset the one-shot guards whenever the flow returns to configuring (fresh start / after retry) so a new attempt
  // can fire its actions again.
  useEffect(
    function resetGuardsOnConfiguring() {
      if (flow.phase === "configuring") {
        createFiredRef.current = false;
        selectFiredRef.current = false;
        deployFiredRef.current = false;
      }
    },
    [flow.phase]
  );

  useEffect(
    function fireCreate() {
      if (flow.phase !== "configuring" || createFiredRef.current) return;
      if (trialError || !isWalletReady) return;
      createFiredRef.current = true;
      flow.actions.requestQuotes(sdlRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, isWalletReady, trialError, retryToken]
  );

  useEffect(
    function recordSelection() {
      if (flow.phase !== "quoting" || selectFiredRef.current || !selectionTarget) return;
      selectFiredRef.current = true;
      const bidId = formatBidId(selectionTarget);
      flow.actions.selectProvider(bidId, bidId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, selectionTarget]
  );

  const hasSelection = Object.keys(flow.selections).length > 0;

  // The matched provider is a pure projection of the flow's own selection (bids/providers drop out of the queries once
  // the lease exists, so we read it back from the selection the autopilot recorded rather than tracking it separately).
  const matchedProviderAddress = useMemo(() => {
    const selectedBidId = Object.values(flow.selections)[0];
    return selectedBidId ? parseBidId(selectedBidId).provider : null;
  }, [flow.selections]);

  useEffect(
    function fireDeploy() {
      // A deploy failure drops the flow back to quoting with a `deployError`; the auto flow surfaces that as a terminal
      // error (there's no manual "pick another provider" step), so we never auto-re-fire deploy after it fails.
      if (flow.phase !== "quoting" || deployFiredRef.current || !hasSelection || flow.deployError) return;
      deployFiredRef.current = true;
      flow.actions.deploy(sdlRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, hasSelection, flow.deployError]
  );

  const projected = projectPhase(flow.phase, flow.deploySucceeded, !!trialError, !!flow.deployError);
  const errorMessage = trialError ? extractApiErrorMessage(trialError) ?? undefined : flow.deployError?.message ?? flow.error?.message;

  const phaseIndex = getPhaseIndex(projected);
  const phases = buildDeployPhases(phaseIndex, projected === "success");

  const progressPercent = usePhasedProgressBar({
    markers: PHASE_MARKERS,
    activeIndex: projected === "success" ? PHASE_MARKERS.length : phaseIndex,
    timeConstants: PHASE_TIME_CONSTANTS,
    resetKey: retryToken
  });

  function retry() {
    setRetryToken(previous => previous + 1);
    // A failed deploy leaves the flow in `quoting` with a live selection and a `deployError`; re-firing `deploy`
    // clears the error and re-attempts the lease without discarding the matched provider.
    if (flow.phase === "quoting" && flow.deployError && hasSelection) {
      deployFiredRef.current = true;
      flow.actions.deploy(sdlRef.current);
      return;
    }
    createFiredRef.current = false;
    selectFiredRef.current = false;
    deployFiredRef.current = false;
    flow.actions.retry();
  }

  return {
    state: projected === "error" ? { kind: "error", message: errorMessage } : { kind: projected },
    progressPercent,
    phases,
    matchedProviderAddress,
    retry,
    startOver: retry
  };
}

type ProjectedPhase = DeployPhaseId | "success" | "error";

/** Projects the manual flow's phase onto the three-step auto progress UI (create → match → prepare) plus success/error. */
function projectPhase(phase: DeploymentFlowPhase, deploySucceeded: boolean, trialErrored: boolean, deployErrored: boolean): ProjectedPhase {
  if (trialErrored || deployErrored || phase === "error") return "error";
  if (deploySucceeded) return "success";
  switch (phase) {
    case "configuring":
    case "creating":
      return "creating";
    case "quoting":
    case "closing":
      return "matching";
    case "deploying":
      return "preparing";
    default:
      return "creating";
  }
}

/** Map the projected phase to an index into `PHASE_ORDER`: success advances past the last marker, error falls back to phase 0. */
function getPhaseIndex(phase: ProjectedPhase): number {
  if (phase === "success") return PHASE_ORDER.length;
  if (phase === "error") return 0;
  return PHASE_ORDER.indexOf(phase);
}
