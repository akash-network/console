import { useEffect, useMemo, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";

import type { BidStrategy, DeploymentIntent } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/deploymentIntent";
import type { DeploymentFlowPhase } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useDeploymentFlow } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import { useServices } from "@src/context/ServicesProvider";
import type { DeployPhase, DeployPhaseId, DeployProgressState } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { PHASE_ORDER, useDeployPhaseProgress } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { BID_POLL_INTERVAL } from "@src/queries/useListBids";
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
  /** Discards the failed attempt — closing the on-chain deployment when one exists — and restarts from creating a fresh one. */
  tryAgain: () => void;
};

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
export function useAutoDeploymentFlow(
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

  // Whether this is a resumed session — a genuine reload that mounted already carrying a dseq (pinned in the intent).
  // A fresh start acquires its dseq later on `flow.dseq`, so that can't retroactively flip it into resume mode. This is
  // only ever a flag; `flow.dseq` stays the single source of the actual sequence for the queries below.
  const isResuming = !!intentRef.current.dseq;

  const [retryToken, setRetryToken] = useState(0);

  // One-shot guard for the selection. Unlike create/deploy (which move the flow off their phase synchronously, so a
  // phase check already prevents a re-fire), selectProvider keeps the flow in "quoting" — so without this a bid-poll
  // refetch that changes the reachable bid could re-select a different provider. This pins us to the first match.
  const selectFiredRef = useRef(false);

  const dseq = flow.dseq;

  // On a resumed session the deployment may already have a lease. Fetch it so we can reconstruct the selection and let
  // the idempotent server create-lease finish, skipping the bid match entirely. Disabled on a fresh start.
  const deploymentQuery = api.v1.getDeployment.useQuery({ dseq: dseq ?? "" }, { enabled: isResuming && !!dseq && flow.phase === "quoting" && isWalletReady });
  const existingActiveLease = deploymentQuery.data?.data.leases.find(lease => lease.state !== "closed");
  /**
   * On a resume we must know whether a lease already exists before matching from bids; a fresh start needs no such
   * wait. Gated on `isSuccess` (not `isFetched`): a failed fetch also flips `isFetched`, which would unblock matching
   * with `existingActiveLease` still unknown and risk creating a duplicate lease against the resumed deployment.
   */
  const resumeLeaseChecked = !isResuming || deploymentQuery.isSuccess;

  // Bids come straight off the flow's own query: the flow is the single owner of the bids subscription, the autopilot
  // only reads them to match a provider. No separate query, no reliance on react-query key dedup.
  const openBids = flow.phase === "quoting" ? flow.bids.filter(bid => bid.bid.state === "open") : [];

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
      return {
        dseq: existingActiveLease.id.dseq,
        gseq: existingActiveLease.id.gseq,
        oseq: existingActiveLease.id.oseq,
        provider: existingActiveLease.id.provider
      };
    }
    if (resumeLeaseChecked && activeBid) {
      return { dseq: activeBid.bid.id.dseq, gseq: activeBid.bid.id.gseq, oseq: activeBid.bid.id.oseq, provider: activeBid.bid.id.provider };
    }
    return null;
  }, [existingActiveLease, resumeLeaseChecked, activeBid]);

  // Release the selection guard whenever the flow returns to configuring (fresh start / after retry) so a new attempt
  // can match again.
  useEffect(
    function resetSelectionGuardOnConfiguring() {
      if (flow.phase === "configuring") {
        selectFiredRef.current = false;
      }
    },
    [flow.phase]
  );

  useEffect(
    function fireCreate() {
      // requestQuotes moves the flow off "configuring" synchronously, so the phase guard alone prevents a re-fire.
      if (flow.phase !== "configuring" || trialError || !isWalletReady) return;
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
      // deploy moves the flow off "quoting" synchronously; a failure drops it back with a `deployError`, which this guard
      // treats as terminal (the auto flow has no manual "pick another provider" step). Together they fire deploy exactly
      // once per attempt, so no separate one-shot ref is needed.
      if (flow.phase !== "quoting" || !hasSelection || flow.deployError) return;
      flow.actions.deploy(sdlRef.current);
    },
    [flow.phase, hasSelection, flow.deployError]
  );

  const projected = projectPhase(flow.phase, flow.deploySucceeded, !!trialError, !!flow.deployError);
  const errorMessage = trialError ? extractApiErrorMessage(trialError) ?? undefined : flow.deployError?.message ?? flow.error?.message;

  const phaseIndex = getPhaseIndex(projected);
  const { progressPercent, phases } = useDeployPhaseProgress(phaseIndex, { succeeded: projected === "success", resetKey: retryToken });

  function tryAgain() {
    // Restart the progress animation, then discard the failed attempt entirely: `cancelAndEdit` closes the deployment
    // on chain when one exists (a failed lease leaves the flow in `quoting` with a live dseq) and returns the flow to
    // `configuring`; a create that never produced a dseq goes straight back to `configuring`. Either way the autopilot's
    // `fireCreate` then broadcasts a brand-new deployment, so "Try again" always starts from scratch rather than
    // re-leasing the same one. The selection guard is released so the fresh attempt can match a provider again.
    setRetryToken(previous => previous + 1);
    selectFiredRef.current = false;
    flow.actions.cancelAndEdit();
  }

  return {
    state: projected === "error" ? { kind: "error", message: errorMessage } : { kind: projected },
    progressPercent,
    phases,
    matchedProviderAddress,
    tryAgain
  };
}

type ProjectedPhase = DeployPhaseId | "success" | "error";

/** Projects the manual flow's phase onto the three-step auto progress UI (create → match → prepare) plus success/error. */
function projectPhase(phase: DeploymentFlowPhase, deploySucceeded: boolean, trialErrored: boolean, deployErrored: boolean): ProjectedPhase {
  if (trialErrored || deployErrored || phase === "error") return "error";
  if (deploySucceeded) return "success";
  switch (phase) {
    // `closing` in the auto flow only ever happens as the first step of "Try again" — tearing down the old deployment
    // before a fresh create — so it restarts progress at "creating" rather than jumping back to matching.
    case "configuring":
    case "creating":
    case "closing":
      return "creating";
    case "quoting":
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
