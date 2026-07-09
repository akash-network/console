import { useEffect, useMemo, useRef, useState } from "react";
import { extractApiErrorMessage } from "@akashnetwork/openapi-sdk";

import type { DeploymentFlow, DeploymentFlowPhase } from "@src/components/deployments/ConfigureDeployment/useDeploymentFlow/useDeploymentFlow";
import type { DeployPhase, DeployPhaseId, DeployProgressState } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { PHASE_ORDER, useDeployPhaseProgress } from "@src/hooks/useAutoDeploymentFlow/deployPhases";
import { BID_POLL_INTERVAL } from "@src/queries/useListBids";
import { useFirstReachableProvider, useProviderList } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId, parseBidId } from "@src/utils/bids/bidId";
import { DeploymentGroups } from "@src/utils/deploymentData/helpers";

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
   * Live (non-closed) leases already on chain for a resumed deployment, resolved once by the `ResumeDeploymentGuard`
   * and passed in so the flow reconstructs a selection per already-leased group and lets the idempotent server
   * create-lease re-send the manifest. Empty on a fresh start or when the deployment has no live leases (which
   * re-quotes from scratch).
   */
  resumeLeases?: LeaseId[];
  /**
   * The shared base flow state machine, created once by the `DeploymentFlowProvider` (which seeds it from the resolved
   * intent — the resumed dseq included — and gates its create on trial readiness). This hook only autopilots over it and
   * projects its phase onto the progress UI; it no longer owns the flow, so the auto and manual branches share one
   * instance. When resuming a dseq, the provider seeds the flow in `quoting`, so the autopilot skips create.
   */
  flow: DeploymentFlow;
};

type Result = {
  state: DeployProgressState;
  progressPercent: number;
  phases: [DeployPhase, DeployPhase, DeployPhase];
  matchedProviderAddress: string | null;
  /**
   * The live deployment dseq once the flow has created (or resumed) one; undefined until then. Lets the auto screen
   * hand the in-progress deployment off to the manual configure form so "Choose my provider" resumes it rather than
   * abandoning it.
   */
  dseq?: string;
  /** Discards the failed attempt — closing the on-chain deployment when one exists — and restarts from creating a fresh one. */
  tryAgain: () => void;
  /**
   * Stops the autopilot from matching a provider and deploying (creating leases). Called when the user takes over via
   * "Choose my provider", so the deployment can be handed to the manual configure form (which shares the same flow)
   * without the autopilot leasing it out from under them. The deployment creation is deliberately left to finish, so
   * the hand-off always inherits a live, quoting deployment rather than a dangling one. Scoped to this auto session —
   * a fresh attempt (a remount, or `tryAgain`) re-enables it.
   */
  stopAutopilot: () => void;
};

/** The four coordinates that identify a lease/bid. */
type LeaseId = { dseq: string; gseq: number; oseq: number; provider: string };

/**
 * The 1-based group sequences (gseqs) the deployment must fill — one per SDL placement. The chain numbers groups in the
 * order they're submitted in the create-deployment message, which is the order `DeploymentGroups` returns them, so the
 * gseq is the group's 1-based index. Falls back to a single group when the SDL can't be parsed so matching still runs.
 */
function getRequiredGseqs(sdl: string): number[] {
  try {
    const count = DeploymentGroups(sdl).length;
    return count > 0 ? Array.from({ length: count }, (_, index) => index + 1) : [1];
  } catch {
    return [1];
  }
}

export const DEPENDENCIES = {
  useProviderList,
  useFirstReachableProvider,
  getRequiredGseqs
};

/**
 * Autopilot + progress projection over the shared base {@link DeploymentFlow}. There is exactly one real state
 * machine — the manual configure flow, created once by the `DeploymentFlowProvider` and passed in as `flow` — and this
 * hook drives it automatically for the auto-deploy (animated globe) experience:
 * it fires `requestQuotes` once the trial wallet is ready, then — for each of the deployment's placements (groups) —
 * watches live bids for that group's first *reachable* provider and records it as the flow's selection, firing `deploy`
 * only once every placement has a provider. The underlying flow owns URL resume, multi-lease, the pre-lease
 * `updateDeployment` reconcile, SDL caching, and the deploy-success redirect — the auto flow inherits all of it for free.
 *
 * On top of the flow it keeps the auto-only concerns: per-group reachability selection (`listBids` + `useProviderList` +
 * `useFirstReachableProvider`), trial gating, reconstructing a selection from each already-leased group (the
 * `ResumeDeploymentGuard` resolves the deployment's leases upfront and passes them in via `resumeLeases`, so the
 * idempotent server create-lease re-sends the manifest), the phased progress-bar animation, and the matched-provider
 * address. `flow.phase` is projected onto the three-step create → match → prepare progress UI.
 */
export function useAutoDeploymentFlow(
  { sdl, isWalletReady, trialError, resumeLeases = [], flow }: Options,
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
): Result {
  const sdlRef = useRef(sdl);
  sdlRef.current = sdl;

  const [retryToken, setRetryToken] = useState(0);

  // Latched on when the user takes manual control ("Choose my provider"): the autopilot stops matching a provider and
  // deploying (creating leases), but still lets the deployment creation finish — so the manual form inherits a live,
  // quoting deployment to drive rather than being handed a dangling one.
  const [autopilotStopped, setAutopilotStopped] = useState(false);

  // One-shot guard per group. Unlike create/deploy (which move the flow off their phase synchronously, so a phase check
  // already prevents a re-fire), selectProvider keeps the flow in "quoting" — so without this a bid-poll refetch that
  // changes a group's reachable bid could re-select it. Holding the set of already-matched gseqs pins each group to its
  // first match.
  const firedGseqsRef = useRef<Set<number>>(new Set());

  const dseq = flow.dseq;

  // The live (non-closed) leases keyed by group sequence, resolved upfront by the `ResumeDeploymentGuard` so a resumed
  // multi-placement deployment restores the provider chosen for each already-leased group. Empty on a fresh start, or
  // when the deployment had no live leases (the guard redirects an already-finished deployment away, so a rendered auto
  // flow either has every group leased — reconstruct the selection and re-send the manifest — or none — match from bids).
  const leasesByGseq = useMemo(() => {
    const byGseq = new Map<number, LeaseId>();
    for (const lease of resumeLeases) {
      byGseq.set(lease.gseq, lease);
    }
    return byGseq;
  }, [resumeLeases]);

  // Every group (gseq) the deployment must fill — one per SDL placement, unioned with any already-leased group so a
  // resume restores every on-chain lease even when the SDL can't be parsed. A bid/lease's gseq identifies its group.
  const requiredGseqs = useMemo(() => {
    const gseqs = new Set(dependencies.getRequiredGseqs(sdl));
    for (const gseq of leasesByGseq.keys()) gseqs.add(gseq);
    return Array.from(gseqs).sort((a, b) => a - b);
  }, [sdl, leasesByGseq, dependencies]);

  // Groups already recorded as flow selections (a bid id embeds its gseq). Reactive, so matching advances group by group.
  const selectedGseqs = useMemo(() => new Set(Object.values(flow.selections).map(bidId => parseBidId(bidId).gseq)), [flow.selections]);

  // The one group we're actively matching a provider for: the first required group that has neither an existing lease nor
  // a recorded selection. Groups resolve one at a time so each gets its own first reachable provider.
  const matchingGseq = requiredGseqs.find(gseq => !leasesByGseq.has(gseq) && !selectedGseqs.has(gseq));

  // Bids come straight off the flow's own query, scoped to the group currently being matched: the flow is the single
  // owner of the bids subscription, the autopilot only reads them to match a provider for that group.
  const openBids =
    flow.phase === "quoting" && matchingGseq !== undefined ? flow.bids.filter(bid => bid.bid.state === "open" && bid.bid.id.gseq === matchingGseq) : [];

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

  // Every selection ready to record now: one per already-leased group (a resume takes those verbatim), plus the first
  // reachable open bid for the group currently being matched. The guard resolves lease state before this flow mounts, so
  // reconstruction and fresh matching never race an existing lease. Empty until there's something to select.
  const selectionTargets = useMemo<LeaseId[]>(() => {
    const targets: LeaseId[] = [];
    for (const gseq of requiredGseqs) {
      const lease = leasesByGseq.get(gseq);
      if (lease) targets.push(lease);
    }
    if (activeBid) {
      targets.push({ dseq: activeBid.bid.id.dseq, gseq: activeBid.bid.id.gseq, oseq: activeBid.bid.id.oseq, provider: activeBid.bid.id.provider });
    }
    return targets;
  }, [requiredGseqs, leasesByGseq, activeBid]);

  // Release the selection guard whenever the flow returns to configuring (fresh start / after retry) so a new attempt
  // can match every group again.
  useEffect(
    function resetSelectionGuardOnConfiguring() {
      if (flow.phase === "configuring") {
        firedGseqsRef.current = new Set();
      }
    },
    [flow.phase]
  );

  useEffect(
    function fireCreate() {
      // requestQuotes moves the flow off "configuring" synchronously, so the phase guard alone prevents a re-fire.
      // The flow lives in the parent provider now, so on mount this child effect runs before the flow's own effects;
      // that's inert here — those effects early-return unless phase === "quoting", and the mount phase is "configuring".
      if (flow.phase !== "configuring" || trialError || !isWalletReady) return;
      flow.actions.requestQuotes(sdlRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, isWalletReady, trialError, retryToken]
  );

  useEffect(
    function recordSelections() {
      if (autopilotStopped || flow.phase !== "quoting") return;
      for (const target of selectionTargets) {
        if (firedGseqsRef.current.has(target.gseq)) continue;
        firedGseqsRef.current.add(target.gseq);
        const bidId = formatBidId(target);
        flow.actions.selectProvider(bidId, bidId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow.phase, selectionTargets, autopilotStopped]
  );

  // A multi-placement deployment leases all its groups together, so deploy waits until every required group has a
  // provider — not just the first.
  const allGroupsSelected = requiredGseqs.length > 0 && requiredGseqs.every(gseq => selectedGseqs.has(gseq));

  // The matched provider is a pure projection of the flow's own selections (bids/providers drop out of the queries once
  // the leases exist, so we read it back from the selections the autopilot recorded rather than tracking it separately).
  const matchedProviderAddress = useMemo(() => {
    const selectedBidId = Object.values(flow.selections)[0];
    return selectedBidId ? parseBidId(selectedBidId).provider : null;
  }, [flow.selections]);

  useEffect(
    function fireDeploy() {
      // deploy moves the flow off "quoting" synchronously; a failure drops it back with a `deployError`, which this guard
      // treats as terminal (the auto flow has no manual "pick another provider" step). Together they fire deploy exactly
      // once per attempt, so no separate one-shot ref is needed.
      if (autopilotStopped || flow.phase !== "quoting" || !allGroupsSelected || flow.deployError) return;
      flow.actions.deploy(sdlRef.current);
    },
    [flow.phase, allGroupsSelected, flow.deployError, autopilotStopped]
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
    firedGseqsRef.current = new Set();
    setAutopilotStopped(false);
    flow.actions.cancelAndEdit();
  }

  // Hand-off for "Choose my provider": stop the autopilot so the manual form can drive the shared flow instead.
  function stopAutopilot() {
    setAutopilotStopped(true);
  }

  return {
    state: projected === "error" ? { kind: "error", message: errorMessage } : { kind: projected },
    progressPercent,
    phases,
    matchedProviderAddress,
    dseq: dseq ?? undefined,
    tryAgain,
    stopAutopilot
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
